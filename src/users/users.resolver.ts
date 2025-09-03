import { Resolver, Query, Mutation, Args, ID, Context } from '@nestjs/graphql';
import { UsersService } from './users.service';
import { User } from './users.model'; // Import the base GraphQL User model/interface
import { CreateUserInput } from './dto/create-user.input';
import { UseGuards, BadRequestException } from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { AdminAuthGuard } from '../admin-auth/guards/admin-auth.guard';
import { CurrentUser, CurrentUserType } from '../auth/decorators/current-user.decorator';
import { UserDocument } from './users.schema';
import { UpdateUserInput } from './dto/update-user.input';
import { UpdateAccountStatusInput } from './dto/update-account-status.input';
import { GetAllUsersArgs } from './dto/get-all-users.args';
import { CombinedAuthGuard } from '../auth/guards/combined-auth.guard'; // <-- IMPORTER LE GARDE UNIFIÉ


@Resolver(() => User) // Specify User as the base type this resolver handles
export class UsersResolver {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(FirebaseAuthGuard) // Ensure this mutation is protected
  @Mutation(() => User, { name: 'createUser' }) // Returns a User, mutation name is 'createUser'
  async createUser(
    @Args('createUserInput') createUserInput: CreateUserInput,
    @CurrentUser() currentUser: CurrentUserType, // Get the authenticated user
  ): Promise<User> {
    // The service's create method returns a UserDocument.
    // GraphQL will automatically map the fields based on your @Field() decorators.
    // Pass the firebaseUid from the authenticated user to the service
    if ('_id' in currentUser) {
      throw new BadRequestException('User already exists');
    }

    const userDocument = await this.usersService.create(createUserInput, currentUser.firebaseUid);
    return userDocument as unknown as User;

  }

  @UseGuards(FirebaseAuthGuard)
  @Query(() => User, { name: 'getUserByFirebaseUid', nullable: true }) // Returns a User or null
  async getUserByFirebaseUid(
    @Args('firebaseUid', { type: () => ID }) firebaseUid: string,
    @CurrentUser() currentUser: UserDocument, // Example of accessing the authenticated user
  ): Promise<User | null> {
    const userDocument = await this.usersService.findByFirebaseUid(firebaseUid);
    if (!userDocument) {
      return null;
    }
    return userDocument as unknown as User;
  }

  // Add other queries (e.g., userById, allUsers) and mutations (e.g., updateUser, deleteUser) here
  @UseGuards(CombinedAuthGuard) // <-- UTILISER LE GARDE UNIFIÉ
  @Query(() => User, { name: 'getUserById', nullable: true }) // 'user' is a common name for fetching by primary ID
  async getUserById(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<User | null> {
    const userDocument = await this.usersService.findById(id);
    if (!userDocument) {
      return null; // Or throw NotFoundGraphQLError
    }
    return userDocument as unknown as User;
  }

  // This query might need admin privileges in a real application
//   @UseGuards(FirebaseAuthGuard) // Basic protection, add role check for admin
  @UseGuards(AdminAuthGuard) // Now protected by AdminAuthGuard
  @Query(() => [User], { name: 'getAllUsers' })
  async getAllUsers(@Args() args: GetAllUsersArgs): Promise<User[]> {
    const users = await this.usersService.findAll(args);
    return users.map(user => user as unknown as User);
  }

  @UseGuards(FirebaseAuthGuard)
  // @UseGuards(CombinedAuthGuard)
  @Mutation(() => User, { name: 'updateMyProfile' })
  async updateMyProfile(
    @Args('updateUserInput') updateUserInput: UpdateUserInput,
    @CurrentUser() currentUser: UserDocument,
  ): Promise<User> {
    const updatedUser = await this.usersService.update(currentUser._id.toString(), updateUserInput);
    return updatedUser as unknown as User;
  }

  @UseGuards(AdminAuthGuard)
  @Mutation(() => User, { name: 'updateUserByAdmin' })
  async updateUserByAdmin(
    @Args('id', { type: () => ID }) id: string,
    @Args('updateUserInput') updateUserInput: UpdateUserInput,
  ): Promise<User> {
    const updatedUser = await this.usersService.update(id, updateUserInput);
    return updatedUser as unknown as User;
  }

  // This mutation should ideally be restricted to admin users
//   @UseGuards(FirebaseAuthGuard) // Basic protection, add role check for admin
  @UseGuards(AdminAuthGuard) // Now protected by AdminAuthGuard
  @Mutation(() => User, { name: 'updateAccountStatus' })
  async updateAccountStatus(
    @Args('updateAccountStatusInput') updateAccountStatusInput: UpdateAccountStatusInput,
  ): Promise<User> {
    const { userId, accountStatus } = updateAccountStatusInput;
    // The service expects the Mongoose enum, GQL enum string values should match
    const updatedUser = await this.usersService.updateAccountStatus(userId, accountStatus as any);
    return updatedUser as unknown as User;
  }

  @UseGuards(FirebaseAuthGuard)
  @Query(() => User, { name: 'me', nullable: true })
  async getMe(@CurrentUser() user: UserDocument): Promise<User | null> {
    // The `user` object is already the UserDocument fetched/created by your AuthService/FirebaseStrategy
    if (!user) {
      return null;
    }
    return user as unknown as User;
  }

  // Add other queries (e.g., userById, allUsers) and mutations (e.g., updateUser, deleteUser) here
}
