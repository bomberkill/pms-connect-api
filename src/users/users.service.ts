import { Injectable, NotFoundException, ConflictException, BadRequestException, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import slugify from 'slugify';
import { PubSub } from 'graphql-subscriptions';
import { randomBytes } from 'crypto';
import { Model, FilterQuery, Types } from 'mongoose';
import {
  User,
  UserDocument,
  IndividualUser, // Import discriminator models
  LegalEntityUser, // Import discriminator models
  UserType, // Import UserType enum
} from './schemas/users.schema'; // Import Mongoose schema/types
import { CreateUserInput } from './dto/create-user.input'; // Import the DTO
import { UserTypeGQL } from './models/users.model';
import { UpdateUserInput } from './dto/update-user.input';
import { AccountStatus } from './schemas/users.schema'; // Mongoose enum
import { GetAllUsersArgs } from './dto/get-all-users.args';
import { ConnectionRequest, ConnectionRequestDocument, ConnectionRequestStatus } from './schemas/connection-request.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/schemas/notification.schema';
import { PUB_SUB } from '../pubsub/pubsub.module';

@Injectable()
export class UsersService {
  // Inject the base User model. Mongoose will handle discriminators.
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(ConnectionRequest.name) private readonly connectionRequestModel: Model<ConnectionRequestDocument>,
    private readonly notificationsService: NotificationsService,
    @Inject(PUB_SUB) private readonly pubSub: PubSub,
  ) {}

  async create(
    createUserInput: CreateUserInput,
    currentUserFirebaseUid: string, // Pass the firebaseUid from the authenticated user
  ): Promise<UserDocument> {
    // Ensure required fields for the specific userType are present
    let baseNameToSlugify: string;
    if (createUserInput.userType === UserTypeGQL.INDIVIDUAL) {
      if (!createUserInput.firstName || !createUserInput.lastName || !createUserInput.speciality) {
        throw new BadRequestException('For INDIVIDUAL users, firstName, lastName, and speciality are required.');
      }
      baseNameToSlugify = `${createUserInput.firstName} ${createUserInput.lastName}`;
    } else if (createUserInput.userType === UserTypeGQL.LEGAL_ENTITY) {
      if (!createUserInput.entityName || !createUserInput.entityType) {
        throw new BadRequestException('For LEGAL_ENTITY users, entityName and entityType are required.');
      }
      baseNameToSlugify = createUserInput.entityName;
    } else {
      // This case should not be hit due to DTO validation, but it's a good safeguard.
      throw new BadRequestException('A valid userType (INDIVIDUAL or LEGAL_ENTITY) is required.');
    }
    // In your UsersService create method:
    const discriminatorKey = createUserInput.userType as string; // e.g., "INDIVIDUAL" or "LEGAL_ENTITY"
    const DiscriminatedModel = this.userModel.discriminators?.[discriminatorKey];

    if (!DiscriminatedModel) {
        // This should ideally not be hit due to DTO validation (@IsEnum(UserTypeGQL)),
        // but it's a good safeguard.
        throw new BadRequestException(`Unsupported user type for model instantiation: ${createUserInput.userType}`);
    }

    // Check for email conflict only if the user is truly new or if the email is changing (which it isn't in this create method)
    const existingUserByEmail = await this.userModel.findOne({ email: createUserInput.email, firebaseUid: { $ne: currentUserFirebaseUid } }).exec();
    if (existingUserByEmail) {
      throw new ConflictException(`Email ${createUserInput.email} is already in use by another account.`);
    }

    // Generate a unique slug
    const slug = await this._generateUniqueSlug(baseNameToSlugify);

    // Create a new instance using the dynamically selected model constructor.
    // Cast to Model<UserDocument> as IndividualUser and LegalEntityUser are subtypes.
    const newUser = new (DiscriminatedModel as Model<UserDocument>)({...createUserInput, firebaseUid: currentUserFirebaseUid, slug });
    return newUser.save();

  }

  async findAll(args: GetAllUsersArgs): Promise<UserDocument[]> {
    const { skip, limit, userType } = args;
    const filters: FilterQuery<UserDocument> = {};

    if (userType) {
      filters.userType = userType;
    }

    return this.userModel.find(filters).skip(skip).limit(limit).exec();
  }

   /**
   * Finds multiple users by their IDs. Essential for DataLoader.
   * @param ids - An array of user IDs.
   * @returns A list of users.
   */
  async findManyByIds(ids: string[]): Promise<UserDocument[]> {
    return this.userModel.find({ _id: { $in: ids } }).exec();
  }

  async findByFirebaseUid(firebaseUid: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ firebaseUid }).exec();
  }

  async findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  async findBySlug(slug: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ slug }).exec();
  }

  async update(
    userId: string, // This should be the MongoDB _id of the user to update
    updateUserInput: UpdateUserInput,
  ): Promise<UserDocument> {
    const userToUpdate = await this.userModel.findById(userId);
    if (!userToUpdate) {
      throw new NotFoundException(`User with ID "${userId}" not found`);
    }

    const updatePayload: Partial<UpdateUserInput> & { slug?: string } = { ...updateUserInput };

    // If name is changing, regenerate the slug
    const { firstName, lastName, entityName } = updateUserInput;
    const userType = userToUpdate.get('userType');

    if (userType === UserType.INDIVIDUAL && (firstName || lastName)) {
      const individualUser = userToUpdate as unknown as IndividualUser;
      const newFirstName = firstName || individualUser.firstName;
      const newLastName = lastName || individualUser.lastName;
      const baseNameToSlugify = `${newFirstName} ${newLastName}`;
      updatePayload.slug = await this._generateUniqueSlug(baseNameToSlugify, userId);
    } else if (userType === UserType.LEGAL_ENTITY && entityName) {
      const legalEntityUser = userToUpdate as unknown as LegalEntityUser;
      const newEntityName = entityName || legalEntityUser.entityName;
      updatePayload.slug = await this._generateUniqueSlug(newEntityName, userId);
    }

    const existingUser = await this.userModel.findByIdAndUpdate(
      userId,
      { $set: updatePayload }, // Use $set to only update provided fields
      { new: true, runValidators: true }, // Return the updated document and run schema validators
    ).exec();

    if (!existingUser) {
      throw new NotFoundException(`User with ID "${userId}" not found`);
    }
    return existingUser;
  }

  async updateAccountStatus(
    userId: string,
    accountStatus: AccountStatus, // Mongoose enum
  ): Promise<UserDocument> {
    const user = await this.userModel.findByIdAndUpdate(
      userId,
      { accountStatus },
      { new: true },
    ).exec();

    if (!user) {
      throw new NotFoundException(`User with ID "${userId}" not found`);
    }
    return user;
  }

  /**
   * Permet à un utilisateur (follower) d'en suivre un autre (following).
   * @param followerId - L'ID de l'utilisateur qui suit.
   * @param followingId - L'ID de l'utilisateur à suivre.
   */
  async follow(followerId: string, followingId: string): Promise<void> {
    if (followerId === followingId) {
      throw new BadRequestException('You cannot follow yourself.');
    }

    // SUGGESTION: Vérifier que l'utilisateur à suivre existe.
    const userToFollow = await this.userModel.findById(followingId).select('_id').lean();
    if (!userToFollow) {
      throw new NotFoundException(`User with ID "${followingId}" not found.`);
    }

    // Utilise $addToSet pour éviter les doublons et effectuer l'opération de manière atomique.
    const updateFollower = this.userModel.findByIdAndUpdate(
      { _id: followerId },
      { $addToSet: { following: new Types.ObjectId(followingId) } },
      { new: true },
    );

    const updateFollowing = this.userModel.findByIdAndUpdate(
      { _id: followingId },
      { $addToSet: { followers: new Types.ObjectId(followerId) } },
      { new: true },
    );

    const [updatedFollower, updatedUserToFollow] = await Promise.all([updateFollower, updateFollowing]);

    if (!updatedUserToFollow) {
      throw new NotFoundException(`User with ID "${followingId}" not found.`);
    }

    const eventPayload = {
      followsUpdated: {
        follower: {
          userId: followerId,
          followersCount: updatedFollower.following.length,
        },
        following: {
          userId: followingId,
          followingCount: updatedUserToFollow.followers.length,
        },
      },
    };

    console.log('Publishing FOLLOWS_UPDATED event with payload:', JSON.stringify(eventPayload, null, 2));

    // Publish a single event with data for both users
    this.pubSub.publish('FOLLOWS_UPDATED', eventPayload);

    console.log('FOLLOWS_UPDATED event published successfully.');

    // Créer la notification
    this.notificationsService.create({
      recipients: [followingId],
      sender: followerId,
      type: NotificationType.NEW_FOLLOWER,
    });
  }

  /**
   * Permet à un utilisateur (follower) de ne plus en suivre un autre (following).
   * @param followerId - L'ID de l'utilisateur qui se désabonne.
   * @param followingId - L'ID de l'utilisateur à ne plus suivre.
   */
  async unfollow(followerId: string, followingId: string): Promise<void> {
    // Utilise $pull pour retirer les IDs des tableaux respectifs.
    const updateFollower = this.userModel.findByIdAndUpdate(
      { _id: followerId },
      { $pull: { following: new Types.ObjectId(followingId) } },
      { new: true },
    );

    const updateFollowing = this.userModel.findByIdAndUpdate(
      { _id: followingId },
      { $pull: { followers: new Types.ObjectId(followerId) } },
      { new: true },
    );

    const [updatedFollower, updatedUserToUnfollow] = await Promise.all([updateFollower, updateFollowing]);

    if (updatedUserToUnfollow) {
      // Publish a single event with data for both users
      this.pubSub.publish('FOLLOWS_UPDATED', {
        followsUpdated: {
          follower: {
            userId: followerId,
            followersCount: updatedFollower.following.length,
          },
          following: {
            userId: followingId,
            followingCount: updatedUserToUnfollow.followers.length,
          },
        },
      });
    }
  }

  /**
   * Supprime une connexion mutuelle entre deux utilisateurs.
   * @param userIdA - ID du premier utilisateur.
   * @param userIdB - ID du second utilisateur.
   */
  async removeConnection(userIdA: string, userIdB: string): Promise<void> {
    // Retire chaque utilisateur de la liste de connexions de l'autre
    const connection = await this.connectionRequestModel.findOne({
      $or: [
        { requester: userIdA, recipient: userIdB, status: ConnectionRequestStatus.ACCEPTED },
        { requester: userIdB, recipient: userIdA, status: ConnectionRequestStatus.ACCEPTED },
      ],
    });

    if (!connection) {
      throw new NotFoundException('No active connection found between these users.');
    }
    connection.status = ConnectionRequestStatus.TERMINATED;
    const updateConnection = connection.save();

    const updateA = this.userModel.updateOne(
      { _id: userIdA },
      { $pull: { connections: new Types.ObjectId(userIdB) } },
    );

    const updateB = this.userModel.updateOne(
      { _id: userIdB },
      { $pull: { connections: new Types.ObjectId(userIdA) } },
    );

    // Choix de conception : rompre une connexion ne rompt pas forcément le suivi.
    // L'utilisateur peut se désabonner manuellement s'il le souhaite.
    const [, , savedRequest] = await Promise.all([updateA, updateB, updateConnection]);

    // Publier l'événement pour notifier les deux utilisateurs
    this.pubSub.publish('CONNECTION_REQUEST_UPDATED', { connectionRequestUpdated: savedRequest });
  }

  /**
   * Adds or removes an FCM token for a user.
   * @param userId The ID of the user.
   * @param token The FCM token to manage.
   * @param action 'add' to register the token, 'remove' to unregister it.
   */
  async manageFcmToken(userId: string, token: string, action: 'add' | 'remove'): Promise<boolean> {
    let updateQuery;

    if (action === 'add') {
      // Use $addToSet to add the token only if it doesn't already exist in the array.
      updateQuery = { $addToSet: { fcmTokens: token } };
    } else {
      // Use $pull to remove the token from the array.
      updateQuery = { $pull: { fcmTokens: token } };
    }

    const result = await this.userModel.updateOne({ _id: userId }, updateQuery);
    return result.modifiedCount > 0;
  }

  private async _generateUniqueSlug(baseName: string, idToExclude: string = null): Promise<string> {
    const baseSlug = slugify(baseName, { lower: true, strict: true, remove: /[*+~.()'"!:@]/g });
    let slug = baseSlug;
    let isUnique = false;

    while (!isUnique) {
        const query: FilterQuery<UserDocument> = { slug: slug };
        if (idToExclude) {
            query._id = { $ne: idToExclude };
        }
        const existingUser = await this.userModel.findOne(query).select('_id').lean();
        if (!existingUser) {
            isUnique = true;
        } else {
            // If slug exists, append a short random hex string to make it unique
            const randomSuffix = randomBytes(3).toString('hex');
            slug = `${baseSlug}-${randomSuffix}`;
        }
    }
    return slug;
  }

  // Add other methods here: findById, findByFirebaseUid, update, delete, etc.
}
