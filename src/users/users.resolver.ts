import {
  Resolver,
  Query,
  Mutation,
  Args,
  ID,
  Subscription,
  Int,
} from '@nestjs/graphql';
import { UsersService } from './users.service';
import { FollowsService } from '../follows/follows.service';
import { User } from './models/users.model'; // Import the base GraphQL User model/interface
import { CreateUserInput } from './dto/create-user.input';
import { UseGuards, BadRequestException, Inject } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { BetterAuthGuard } from '../auth/guards/better-auth.guard';
import { AdminAuthGuard } from '../admin-auth/guards/admin-auth.guard';
import {
  CurrentUser,
  CurrentUserType,
} from '../auth/decorators/current-user.decorator';
import { UserDocument } from './schemas/users.schema';
import { UpdateUserInput } from './dto/update-user.input';
import { UpdateAccountStatusInput } from './dto/update-account-status.input';
import { GetAllUsersArgs } from './dto/get-all-users.args';
import { PaginationArgs } from '../posts/dto/pagination.args';
import { CombinedAuthGuard } from '../auth/guards/combined-auth.guard';
import { FollowsUpdate } from './models/follower-count-update.model';
import { PUB_SUB } from '../pubsub/pubsub.module';
import { GqlWsAuthGuard } from 'src/auth/guards/gql-ws-auth.guard';
import { ConnectionRequestsService } from './connection-requests.service';

@Resolver(() => User) // Specify User as the base type this resolver handles
export class UsersResolver {
  constructor(
    private readonly usersService: UsersService,
    private readonly followsService: FollowsService,
    private readonly connectionRequestsService: ConnectionRequestsService,
    @Inject(PUB_SUB) private readonly pubSub: PubSub,
  ) {}

  @UseGuards(BetterAuthGuard) // Ensure this mutation is protected
  @Mutation(() => User, { name: 'createUser' }) // Returns a User, mutation name is 'createUser'
  async createUser(
    @Args('createUserInput') createUserInput: CreateUserInput,
    @CurrentUser() currentUser: CurrentUserType, // Get the authenticated user
  ): Promise<UserDocument> {
    // The service's create method returns a UserDocument.
    // GraphQL will automatically map the fields based on your @Field() decorators.
    // Pass the authUserId from the authenticated user to the service
    if ('_id' in currentUser) {
      throw new BadRequestException('User already exists');
    }
    return this.usersService.create(createUserInput, currentUser.authUserId);
  }

  @UseGuards(BetterAuthGuard)
  @Query(() => User, { name: 'getUserByAuthUserId', nullable: true }) // Returns a User or null
  async getUserByAuthUserId(
    @Args('authUserId', { type: () => ID }) authUserId: string,
  ): Promise<UserDocument | null> {
    const userDocument = await this.usersService.findByAuthUserId(authUserId);
    if (!userDocument) {
      return null;
    }
    return userDocument;
  }

  // Add other queries (e.g., userById, allUsers) and mutations (e.g., updateUser, deleteUser) here
  @UseGuards(CombinedAuthGuard) // Correct: Accessible by both Admin and App Users
  @Query(() => User, { name: 'getUserById', nullable: true }) // 'user' is a common name for fetching by primary ID
  async getUserById(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<UserDocument | null> {
    const userDocument = await this.usersService.findById(id);
    if (!userDocument) {
      return null; // Or throw NotFoundGraphQLError
    }
    return userDocument;
  }

  @UseGuards(CombinedAuthGuard)
  @Query(() => User, { name: 'getUserBySlug', nullable: true })
  async getUserBySlug(
    @Args('slug', { type: () => String }) slug: string,
  ): Promise<UserDocument | null> {
    const userDocument = await this.usersService.findBySlug(slug);
    if (!userDocument) {
      return null;
    }
    return userDocument;
  }

  // Used by both the admin panel (user management list) and the app's
  // "people you may know" suggestions feature for regular signed-in users —
  // CombinedAuthGuard is intentional here, not a placeholder.
  @UseGuards(CombinedAuthGuard)
  @Query(() => [User], { name: 'getAllUsers' })
  async getAllUsers(@Args() args: GetAllUsersArgs): Promise<UserDocument[]> {
    return this.usersService.findAll(args);
  }

  @UseGuards(BetterAuthGuard) // Correct: Only a user can update their OWN profile
  @Mutation(() => User, { name: 'updateMyProfile' })
  async updateMyProfile(
    @Args('updateUserInput') updateUserInput: UpdateUserInput,
    @CurrentUser() currentUser: UserDocument,
  ): Promise<UserDocument> {
    return this.usersService.update(
      currentUser._id.toString(),
      updateUserInput,
    );
  }

  @UseGuards(BetterAuthGuard)
  @Mutation(() => User, {
    name: 'updateMyEmail',
    description: "Updates the authenticated user's email address.",
  })
  async updateMyEmail(
    @Args('newEmail', { type: () => String }) newEmail: string,
    @CurrentUser() currentUser: UserDocument,
  ): Promise<UserDocument> {
    // The service handles updating the email in the local database
    return this.usersService.updateEmail(currentUser, newEmail);
  }

  @UseGuards(AdminAuthGuard)
  @Mutation(() => User, { name: 'updateUserByAdmin' })
  async updateUserByAdmin(
    @Args('id', { type: () => ID }) id: string,
    @Args('updateUserInput') updateUserInput: UpdateUserInput,
  ): Promise<UserDocument> {
    return this.usersService.update(id, updateUserInput);
  }

  // This mutation should ideally be restricted to admin users
  // @UseGuards(BetterAuthGuard) // Basic protection, add role check for admin
  @UseGuards(AdminAuthGuard) // Correct: Account status change is Strict Admin
  @Mutation(() => User, { name: 'updateAccountStatus' })
  async updateAccountStatus(
    @Args('updateAccountStatusInput')
    updateAccountStatusInput: UpdateAccountStatusInput,
  ): Promise<UserDocument> {
    const { userId, accountStatus } = updateAccountStatusInput;
    // The service expects the Mongoose enum, GQL enum string values should match
    return this.usersService.updateAccountStatus(userId, accountStatus as any);
  }

  @UseGuards(BetterAuthGuard)
  @Query(() => User, { name: 'me', nullable: true })
  async getMe(
    @CurrentUser() user: CurrentUserType,
  ): Promise<UserDocument | null> {
    // `user` is the UserDocument fetched by AuthService/BetterAuthStrategy, or
    // a transient `{ authUserId }` shape when the Better Auth session is
    // valid but no Mongo profile exists yet — the `User` GraphQL interface
    // can't resolve a concrete type for that shape, so treat it as absent.
    if (!user || !('_id' in user)) {
      return null;
    }
    return user;
  }

  // --- Follow / Unfollow Mutations ---

  @UseGuards(BetterAuthGuard)
  @Mutation(() => Boolean, { name: 'follow' })
  async follow(
    @Args('userId', { type: () => ID }) userIdToFollow: string,
    @CurrentUser() currentUser: UserDocument,
  ): Promise<boolean> {
    await this.usersService.follow(currentUser._id.toString(), userIdToFollow);
    return true;
  }

  @UseGuards(BetterAuthGuard)
  @Mutation(() => Boolean, { name: 'unfollow' })
  async unfollow(
    @Args('userId', { type: () => ID }) userIdToUnfollow: string,
    @CurrentUser() currentUser: UserDocument,
  ): Promise<boolean> {
    await this.usersService.unfollow(
      currentUser._id.toString(),
      userIdToUnfollow,
    );
    return true;
  }

  @UseGuards(BetterAuthGuard)
  @Query(() => [User], { name: 'getFollowers' })
  async getFollowers(
    @Args('userId', { type: () => ID }) userId: string,
    @Args() { skip, limit }: PaginationArgs,
  ): Promise<UserDocument[]> {
    return this.usersService.getFollowers(userId, skip, limit);
  }

  @UseGuards(AdminAuthGuard)
  @Query(() => [User], { name: 'adminGetFollowers' })
  async adminGetFollowers(
    @Args('userId', { type: () => ID }) userId: string,
    @Args() { skip, limit }: PaginationArgs,
  ): Promise<UserDocument[]> {
    return this.usersService.getFollowers(userId, skip, limit);
  }

  @UseGuards(BetterAuthGuard)
  @Query(() => [User], { name: 'getFollowing' })
  async getFollowing(
    @Args('userId', { type: () => ID }) userId: string,
    @Args() { skip, limit }: PaginationArgs,
  ): Promise<UserDocument[]> {
    return this.usersService.getFollowing(userId, skip, limit);
  }

  @UseGuards(AdminAuthGuard)
  @Query(() => [User], { name: 'adminGetFollowing' })
  async adminGetFollowing(
    @Args('userId', { type: () => ID }) userId: string,
    @Args() { skip, limit }: PaginationArgs,
  ): Promise<UserDocument[]> {
    return this.usersService.getFollowing(userId, skip, limit);
  }

  @UseGuards(BetterAuthGuard)
  @Query(() => Int, { name: 'getFollowersCount' })
  async getFollowersCount(
    @Args('userId', { type: () => ID }) userId: string,
  ): Promise<number> {
    return this.followsService.getFollowersCount(userId);
  }

  @UseGuards(BetterAuthGuard)
  @Query(() => Int, { name: 'getFollowingCount' })
  async getFollowingCount(
    @Args('userId', { type: () => ID }) userId: string,
  ): Promise<number> {
    return this.followsService.getFollowingCount(userId);
  }

  @UseGuards(BetterAuthGuard)
  @Mutation(() => Boolean, { name: 'removeConnection' })
  async removeConnection(
    @Args('userIdB', { type: () => ID }) userIdB: string,
    @CurrentUser() currentUser: UserDocument,
  ): Promise<boolean> {
    await this.usersService.removeConnection(
      currentUser._id.toString(),
      userIdB,
    );
    return true;
  }

  @UseGuards(AdminAuthGuard)
  @Query(() => [User], { name: 'adminGetConnections' })
  async adminGetConnections(
    @Args('userId', { type: () => ID }) userId: string,
    @Args() { skip, limit }: PaginationArgs,
  ): Promise<UserDocument[]> {
    return this.connectionRequestsService.getConnections(userId, skip, limit);
  }

  @UseGuards(BetterAuthGuard)
  @Mutation(() => Boolean, { name: 'registerFcmToken' })
  async registerFcmToken(
    @Args('token', { type: () => String }) token: string,
    @CurrentUser() currentUser: UserDocument,
  ): Promise<boolean> {
    return this.usersService.manageFcmToken(
      currentUser._id.toString(),
      token,
      'add',
    );
  }

  @UseGuards(BetterAuthGuard)
  @Mutation(() => Boolean, { name: 'unregisterFcmToken' })
  async unregisterFcmToken(
    @Args('token', { type: () => String }) token: string,
    @CurrentUser() currentUser: UserDocument,
  ): Promise<boolean> {
    return this.usersService.manageFcmToken(
      currentUser._id.toString(),
      token,
      'remove',
    );
  }

  @UseGuards(GqlWsAuthGuard)
  @Subscription(() => FollowsUpdate, {
    name: 'followsUpdated',
    nullable: true,
    filter: (payload, variables) => {
      console.log('--- FollowsUpdated Subscription Filter ---');
      // console.log('Received payload:', JSON.stringify(payload, null, 2));
      // console.log('Received variables:', JSON.stringify(variables, null, 2));

      // Defensive check: ignore malformed events
      if (!payload || !payload.followsUpdated) {
        // console.log('Filter result: false (malformed payload)');
        return false;
      }
      // Let the event pass if the subscribed user is either the follower or the one being followed.
      const { follower, following } = payload.followsUpdated;
      const isUserInvolved =
        follower.userId === variables.userId ||
        following.userId === variables.userId;
      // console.log(`Filter condition: ${follower.userId} === ${variables.userId} || ${following.userId} === ${variables.userId}`);
      // console.log('Filter result:', isUserInvolved);
      // console.log('------------------------------------------');
      return isUserInvolved;
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    resolve: (payload, _args, _context) => {
      // console.log("payload: ", payload, " and payload.followsUpdated: ")
      // Return the full payload. The client will decide which part to use.
      return payload?.followsUpdated;
    },
  })
  // @UseGuards(BetterAuthGuard) // Optional: Protect who can subscribe
  followsUpdated(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    @Args('userId', { type: () => ID }) _userId: string,
  ) {
    return this.pubSub.asyncIterableIterator('FOLLOWS_UPDATED');
  }
}
