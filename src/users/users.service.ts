import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
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
} from './schemas/users.schema';
import { CreateUserInput } from './dto/create-user.input'; // Import the DTO
import { UserTypeGQL } from './models/users.model';
import { UpdateUserInput } from './dto/update-user.input';
import { AccountStatus } from './schemas/users.schema'; // Mongoose enum
import { GetAllUsersArgs } from './dto/get-all-users.args';
import {
  ConnectionRequest,
  ConnectionRequestDocument,
  ConnectionRequestStatus,
} from './schemas/connection-request.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/schemas/notification.schema';
import { PUB_SUB } from '../pubsub/pubsub.module';
import { FollowsService } from '../follows/follows.service';

@Injectable()
export class UsersService {
  // Inject the base User model. Mongoose will handle discriminators.
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(ConnectionRequest.name)
    private readonly connectionRequestModel: Model<ConnectionRequestDocument>,
    private readonly notificationsService: NotificationsService,
    private readonly followsService: FollowsService,
    @Inject(PUB_SUB) private readonly pubSub: PubSub,
  ) {}

  async create(
    createUserInput: CreateUserInput,
    currentUserFirebaseUid: string, // Pass the firebaseUid from the authenticated user
  ): Promise<UserDocument> {
    // Ensure required fields for the specific userType are present
    let baseNameToSlugify: string;
    if (createUserInput.userType === UserTypeGQL.INDIVIDUAL) {
      if (
        !createUserInput.firstName ||
        !createUserInput.lastName ||
        !createUserInput.speciality
      ) {
        throw new BadRequestException(
          'For INDIVIDUAL users, firstName, lastName, and speciality are required.',
        );
      }
      baseNameToSlugify = `${createUserInput.firstName} ${createUserInput.lastName}`;
    } else if (createUserInput.userType === UserTypeGQL.LEGAL_ENTITY) {
      if (!createUserInput.entityName || !createUserInput.entityType) {
        throw new BadRequestException(
          'For LEGAL_ENTITY users, entityName and entityType are required.',
        );
      }
      baseNameToSlugify = createUserInput.entityName;
    } else {
      // This case should not be hit due to DTO validation, but it's a good safeguard.
      throw new BadRequestException(
        'A valid userType (INDIVIDUAL or LEGAL_ENTITY) is required.',
      );
    }
    // In your UsersService create method:
    const discriminatorKey = createUserInput.userType as string; // e.g., "INDIVIDUAL" or "LEGAL_ENTITY"
    const DiscriminatedModel =
      this.userModel.discriminators?.[discriminatorKey];

    if (!DiscriminatedModel) {
      // This should ideally not be hit due to DTO validation (@IsEnum(UserTypeGQL)),
      // but it's a good safeguard.
      throw new BadRequestException(
        `Unsupported user type for model instantiation: ${createUserInput.userType}`,
      );
    }

    // Check for email conflict only if the user is truly new or if the email is changing (which it isn't in this create method)
    const existingUserByEmail = await this.userModel
      .findOne({
        email: createUserInput.email,
        firebaseUid: { $ne: currentUserFirebaseUid },
      })
      .exec();
    if (existingUserByEmail) {
      throw new ConflictException(
        `Email ${createUserInput.email} is already in use by another account.`,
      );
    }

    // Generate a unique slug
    const slug = await this._generateUniqueSlug(baseNameToSlugify);

    // Create a new instance using the dynamically selected model constructor.
    // Cast to Model<UserDocument> as IndividualUser and LegalEntityUser are subtypes.
    const newUser = new (DiscriminatedModel as Model<UserDocument>)({
      ...createUserInput,
      firebaseUid: currentUserFirebaseUid,
      slug,
    });
    return newUser.save();
  }

  async findAll(args: GetAllUsersArgs): Promise<UserDocument[]> {
    const { skip, limit, userType } = args;
    const filters: FilterQuery<UserDocument> = {};

    if (userType) {
      filters.userType = userType;
    }

    // Populate bookmarks for a full user object response
    return this.userModel.find(filters).skip(skip).limit(limit).exec();
  }

  /**
   * Finds multiple users by their IDs. Essential for DataLoader.
   * @param ids - An array of user IDs.
   * @returns A list of users.
   */
  async findManyByIds(ids: string[]): Promise<UserDocument[]> {
    // Populate bookmarks for a full user object response
    return this.userModel.find({ _id: { $in: ids } }).exec();
  }

  async findByFirebaseUid(firebaseUid: string): Promise<UserDocument | null> {
    // Populate bookmarks for a full user object response
    const result = await this.userModel.findOne({ firebaseUid }).exec();
    // console.log('findByFirebaseUid service:', result)
    return result;
  }

  async findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  async findBySlug(slug: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ slug }).populate('bookmarks.item').exec();
  }

  /**
   * Finds a user by their email address.
   * @param email The email to search for.
   * @returns A user document or null.
   */
  async findByEmail(email: string): Promise<UserDocument | null> {
    // Emails are stored in lowercase, so the search should also be case-insensitive.
    return this.userModel.findOne({ email: email.toLowerCase() }).exec();
  }

  /**
   * Finds a user by their phone number.
   * @param phoneNumber The phone number to search for.
   */
  async findByPhoneNumber(phoneNumber: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ phoneNumber }).exec();
  }

  async existsByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ email: email.toLowerCase() })
      .select('_id providers')
      .lean()
      .exec() as Promise<UserDocument | null>;
  }

  /**
   * Gets all followers for a specific user.
   * Returns all users that have the specified user in their 'following' array.
   */
  async getFollowers(userId: string): Promise<UserDocument[]> {
    const user = await this.userModel.findById(userId).select('_id').lean();
    if (!user) {
      throw new NotFoundException(`User with ID "${userId}" not found.`);
    }

    // Find all users who have this userId in their 'following' array
    return this.userModel.find({ following: userId }).exec();
  }

  /**
   * Gets all users that a specific user is following.
   * Returns all users in the user's 'following' array.
   */
  async getFollowing(userId: string): Promise<UserDocument[]> {
    const user = await this.userModel
      .findById(userId)
      .select('following')
      .lean();

    if (!user) {
      throw new NotFoundException(`User with ID "${userId}" not found.`);
    }

    // Fetch all users that this user is following
    return this.userModel.find({ _id: { $in: user.following } }).exec();
  }

  async update(
    userId: string, // This should be the MongoDB _id of the user to update
    updateUserInput: UpdateUserInput,
  ): Promise<UserDocument> {
    const userToUpdate = await this.userModel.findById(userId);
    if (!userToUpdate) {
      throw new NotFoundException(`User with ID "${userId}" not found`);
    }

    const updatePayload: Partial<UpdateUserInput> & { slug?: string } = {
      ...updateUserInput,
    };

    // If name is changing, regenerate the slug
    const { firstName, lastName, entityName } = updateUserInput;
    const userType = userToUpdate.get('userType');

    if (userType === UserType.INDIVIDUAL && (firstName || lastName)) {
      const individualUser = userToUpdate as unknown as IndividualUser;
      const newFirstName = firstName || individualUser.firstName;
      const newLastName = lastName || individualUser.lastName;
      const baseNameToSlugify = `${newFirstName} ${newLastName}`;
      updatePayload.slug = await this._generateUniqueSlug(
        baseNameToSlugify,
        userId,
      );
    } else if (userType === UserType.LEGAL_ENTITY && entityName) {
      const legalEntityUser = userToUpdate as unknown as LegalEntityUser;
      const newEntityName = entityName || legalEntityUser.entityName;
      updatePayload.slug = await this._generateUniqueSlug(
        newEntityName,
        userId,
      );
    }

    const existingUser = await this.userModel
      .findByIdAndUpdate(
        userId,
        { $set: updatePayload }, // Use $set to only update provided fields
        { new: true, runValidators: true }, // Return the updated document and run schema validators
      )
      .exec();

    if (!existingUser) {
      throw new NotFoundException(`User with ID "${userId}" not found`);
    }
    return existingUser;
  }

  async updateEmail(
    currentUser: UserDocument,
    newEmail: string,
  ): Promise<UserDocument> {
    const normalizedNewEmail = newEmail.toLowerCase().trim();

    if (currentUser.email === normalizedNewEmail) {
      // Pas de changement, on retourne l'utilisateur actuel.
      return currentUser;
    }

    // 1. Vérifier si le nouvel e-mail est déjà utilisé par un AUTRE utilisateur.
    const existingUser = await this.userModel
      .findOne({
        email: normalizedNewEmail,
        firebaseUid: { $ne: currentUser.firebaseUid }, // On s'assure que ce n'est pas le même utilisateur
      })
      .exec();

    if (existingUser) {
      throw new ConflictException('This email address is already in use.');
    }

    // 2. Mettre à jour l'e-mail dans la base de données pour l'utilisateur identifié par son firebaseUid.
    const updatedUser = await this.userModel
      .findOneAndUpdate(
        { firebaseUid: currentUser.firebaseUid },
        { $set: { email: normalizedNewEmail } },
        { new: true }, // Retourne le document mis à jour
      )
      .exec();

    return updatedUser;
  }

  async updateAccountStatus(
    userId: string,
    accountStatus: AccountStatus, // Mongoose enum
  ): Promise<UserDocument> {
    const user = await this.userModel
      .findByIdAndUpdate(userId, { accountStatus }, { new: true })
      .exec();

    if (!user) {
      throw new NotFoundException(`User with ID "${userId}" not found`);
    }
    return user;
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
        {
          requester: userIdA,
          recipient: userIdB,
          status: ConnectionRequestStatus.ACCEPTED,
        },
        {
          requester: userIdB,
          recipient: userIdA,
          status: ConnectionRequestStatus.ACCEPTED,
        },
      ],
    });

    if (!connection) {
      throw new NotFoundException(
        'No active connection found between these users.',
      );
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
    const [, , savedRequest] = await Promise.all([
      updateA,
      updateB,
      updateConnection,
    ]);

    // Publier l'événement pour notifier les deux utilisateurs
    this.pubSub.publish('CONNECTION_REQUEST_UPDATED', {
      connectionRequestUpdated: savedRequest,
    });
  }

  /**
   * Adds or removes an FCM token for a user.
   * @param userId The ID of the user.
   * @param token The FCM token to manage.
   * @param action 'add' to register the token, 'remove' to unregister it.
   */
  async manageFcmToken(
    userId: string,
    token: string,
    action: 'add' | 'remove',
  ): Promise<boolean> {
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

  private async _generateUniqueSlug(
    baseName: string,
    idToExclude: string = null,
  ): Promise<string> {
    const baseSlug = slugify(baseName, {
      lower: true,
      strict: true,
      remove: /[*+~.()'"!:@]/g,
    });
    let slug = baseSlug;
    let isUnique = false;

    while (!isUnique) {
      const query: FilterQuery<UserDocument> = { slug: slug };
      if (idToExclude) {
        query._id = { $ne: idToExclude };
      }
      const existingUser = await this.userModel
        .findOne(query)
        .select('_id')
        .lean();
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
  // --- Follow / Unfollow Methods (using FollowsService) ---

  /**
   * Follow a user
   */
  async follow(followerId: string, followingId: string): Promise<void> {
    // Verify both users exist
    const [follower, following] = await Promise.all([
      this.findById(followerId),
      this.findById(followingId),
    ]);

    if (!follower || !following) {
      throw new NotFoundException('User not found');
    }

    // Use FollowsService to create follow relationship
    await this.followsService.followUser(followerId, followingId);

    // Create notification
    await this.notificationsService.create({
      recipients: [followingId],
      sender: followerId,
      type: NotificationType.NEW_FOLLOWER,
      entityId: followerId,
      onModel: 'User',
    });

    // Publish to subscription
    const followerCount =
      await this.followsService.getFollowersCount(followingId);
    const followingCount =
      await this.followsService.getFollowingCount(followerId);

    await this.pubSub.publish('followsUpdated', {
      followsUpdated: {
        follower: { userId: followerId, followingCount },
        following: { userId: followingId, followerCount },
      },
    });
  }

  /**
   * Unfollow a user
   */
  async unfollow(followerId: string, followingId: string): Promise<void> {
    // Use FollowsService to remove follow relationship
    await this.followsService.unfollowUser(followerId, followingId);

    // Publish to subscription
    const followerCount =
      await this.followsService.getFollowersCount(followingId);
    const followingCount =
      await this.followsService.getFollowingCount(followerId);

    await this.pubSub.publish('followsUpdated', {
      followsUpdated: {
        follower: { userId: followerId, followingCount },
        following: { userId: followingId, followerCount },
      },
    });
  }
}
