import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery } from 'mongoose';
import {
  User,
  UserDocument,
  IndividualUser, // Import discriminator models
  LegalEntityUser, // Import discriminator models
  UserType, // Import UserType enum
} from './users.schema'; // Import Mongoose schema/types
import { CreateUserInput } from './dto/create-user.input'; // Import the DTO
import { UserTypeGQL } from './users.model';
import { UpdateUserInput } from './dto/update-user.input';
import { AccountStatus } from './users.schema'; // Mongoose enum
import { GetAllUsersArgs } from './dto/get-all-users.args';

@Injectable()
export class UsersService {
  // Inject the base User model. Mongoose will handle discriminators.
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async create(
    createUserInput: CreateUserInput,
    currentUserFirebaseUid: string, // Pass the firebaseUid from the authenticated user
  ): Promise<UserDocument> {
    // Ensure required fields for the specific userType are present
    if (createUserInput.userType === UserTypeGQL.INDIVIDUAL) {
      if (!createUserInput.firstName || !createUserInput.lastName || !createUserInput.speciality) {
        throw new BadRequestException('For INDIVIDUAL users, firstName, lastName, and speciality are required.');
      }
    } else if (createUserInput.userType === UserTypeGQL.LEGAL_ENTITY) {
      if (!createUserInput.entityName || !createUserInput.entityType) {
        throw new BadRequestException('For LEGAL_ENTITY users, entityName and entityType are required.');
      }
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


    // Create a new instance using the dynamically selected model constructor.
    // Cast to Model<UserDocument> as IndividualUser and LegalEntityUser are subtypes.
    const newUser = new (DiscriminatedModel as Model<UserDocument>)({...createUserInput, firebaseUid: currentUserFirebaseUid});
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

  async findByFirebaseUid(firebaseUid: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ firebaseUid }).exec();
  }

  async findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  async update(
    userId: string, // This should be the MongoDB _id of the user to update
    updateUserInput: UpdateUserInput,
  ): Promise<UserDocument> {
    const existingUser = await this.userModel.findByIdAndUpdate(
      userId,
      { $set: updateUserInput }, // Use $set to only update provided fields
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


  // Add other methods here: findById, findByFirebaseUid, update, delete, etc.
}
