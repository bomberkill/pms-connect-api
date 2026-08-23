import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import slugify from 'slugify';
import { PubSub } from 'graphql-subscriptions';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserInput } from './dto/create-user.input';
import { UserTypeGQL } from './models/users.model';
import { UpdateUserInput } from './dto/update-user.input';
import { UserType, AccountStatus } from '../../generated/prisma/enums';
import { GetAllUsersArgs } from './dto/get-all-users.args';
import { ConnectionRequestStatus } from '../../generated/prisma/enums';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/schemas/notification.schema';
import { PUB_SUB } from '../pubsub/pubsub.module';
import { FollowsService } from '../follows/follows.service';
import { BlocksService } from '../blocks/blocks.service';
import type { UserModel } from '../../generated/prisma/models';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    // Circular with NotificationsService (see notifications.service.ts) —
    // forwardRef() on both sides to avoid relying on require-order luck.
    @Inject(forwardRef(() => NotificationsService))
    private readonly notificationsService: NotificationsService,
    private readonly followsService: FollowsService,
    private readonly blocksService: BlocksService,
    @Inject(PUB_SUB) private readonly pubSub: PubSub,
  ) {}

  async create(createUserInput: CreateUserInput, currentUserAuthId: string) {
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
      throw new BadRequestException(
        'A valid userType (INDIVIDUAL or LEGAL_ENTITY) is required.',
      );
    }

    const existingUserByEmail = await this.prisma.user.findFirst({
      where: {
        email: createUserInput.email,
        authUserId: { not: currentUserAuthId },
      },
    });
    if (existingUserByEmail) {
      throw new ConflictException(
        `Email ${createUserInput.email} is already in use by another account.`,
      );
    }

    const slug = await this._generateUniqueSlug(baseNameToSlugify);
    const { location, professionalAccreditation, ...rest } = createUserInput;

    return this.prisma.user.create({
      data: {
        ...rest,
        authUserId: currentUserAuthId,
        slug,
        userType: createUserInput.userType as unknown as UserType,
        ...(location && {
          addressLine1: location.addressLine1,
          addressLine2: location.addressLine2,
          city: location.city,
          stateOrProvince: location.stateOrProvince,
          postalCode: location.postalCode,
          country: location.country,
        }),
        ...(professionalAccreditation && {
          professionalAccreditations: {
            create: professionalAccreditation,
          },
        }),
      },
    });
  }

  async findAll(args: GetAllUsersArgs) {
    const { skip, limit, userType } = args;
    return this.prisma.user.findMany({
      where: userType ? { userType: userType as unknown as UserType } : {},
      skip,
      take: limit,
    });
  }

  /**
   * Finds multiple users by their IDs. Essential for DataLoader.
   */
  async findManyByIds(ids: string[]) {
    return this.prisma.user.findMany({ where: { id: { in: ids } } });
  }

  async findByAuthUserId(authUserId: string) {
    return this.prisma.user.findUnique({ where: { authUserId } });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findBySlug(slug: string) {
    return this.prisma.user.findUnique({ where: { slug } });
  }

  /**
   * Ids of users this user has blocked. Replaces the old User.blockedUsers
   * array with a query against the dedicated Block table.
   */
  async getBlockedUserIds(userId: string): Promise<string[]> {
    const blocks = await this.prisma.block.findMany({
      where: { blockerId: userId },
      select: { blockedId: true },
    });
    return blocks.map((b) => b.blockedId);
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
  }

  async findByPhoneNumber(phoneNumber: string) {
    return this.prisma.user.findFirst({ where: { phoneNumber } });
  }

  async existsByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, providers: true },
    });
  }

  async update(userId: string, updateUserInput: UpdateUserInput) {
    const userToUpdate = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!userToUpdate) {
      throw new NotFoundException(`User with ID "${userId}" not found`);
    }

    const { location, professionalAccreditation, firstName, lastName, entityName, ...rest } =
      updateUserInput;

    let slug: string | undefined;
    if (
      userToUpdate.userType === UserType.INDIVIDUAL &&
      (firstName || lastName)
    ) {
      const newFirstName = firstName || userToUpdate.firstName;
      const newLastName = lastName || userToUpdate.lastName;
      slug = await this._generateUniqueSlug(
        `${newFirstName} ${newLastName}`,
        userId,
      );
    } else if (
      userToUpdate.userType === UserType.LEGAL_ENTITY &&
      entityName
    ) {
      slug = await this._generateUniqueSlug(entityName, userId);
    }

    if (professionalAccreditation) {
      await this.prisma.professionalAccreditation.deleteMany({
        where: { userId },
      });
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...rest,
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
        ...(entityName && { entityName }),
        ...(slug && { slug }),
        ...(location && {
          addressLine1: location.addressLine1,
          addressLine2: location.addressLine2,
          city: location.city,
          stateOrProvince: location.stateOrProvince,
          postalCode: location.postalCode,
          country: location.country,
        }),
        ...(professionalAccreditation && {
          professionalAccreditations: {
            create: professionalAccreditation,
          },
        }),
      },
    });
  }

  async updateEmail(currentUser: UserModel, newEmail: string) {
    const normalizedNewEmail = newEmail.toLowerCase().trim();

    if (currentUser.email === normalizedNewEmail) {
      return currentUser;
    }

    const existingUser = await this.prisma.user.findFirst({
      where: {
        email: normalizedNewEmail,
        authUserId: { not: currentUser.authUserId },
      },
    });

    if (existingUser) {
      throw new ConflictException('This email address is already in use.');
    }

    return this.prisma.user.update({
      where: { authUserId: currentUser.authUserId },
      data: { email: normalizedNewEmail },
    });
  }

  async updateAccountStatus(userId: string, accountStatus: AccountStatus) {
    try {
      return await this.prisma.user.update({
        where: { id: userId },
        data: { accountStatus },
      });
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`User with ID "${userId}" not found`);
      }
      throw error;
    }
  }

  /**
   * Terminates a mutual connection between two users. There's no separate
   * "connections" list to update — "is connected" is derived from an
   * ACCEPTED ConnectionRequest between the pair.
   */
  async removeConnection(userIdA: string, userIdB: string): Promise<void> {
    const connection = await this.prisma.connectionRequest.findFirst({
      where: {
        status: ConnectionRequestStatus.ACCEPTED,
        OR: [
          { requesterId: userIdA, recipientId: userIdB },
          { requesterId: userIdB, recipientId: userIdA },
        ],
      },
    });

    if (!connection) {
      throw new NotFoundException(
        'No active connection found between these users.',
      );
    }

    const updated = await this.prisma.connectionRequest.update({
      where: { id: connection.id },
      data: { status: ConnectionRequestStatus.TERMINATED },
      include: { requester: true, recipient: true },
    });

    // Design choice: breaking a connection doesn't automatically unfollow.
    // Users can unfollow manually if they want to.
    this.pubSub.publish('CONNECTION_REQUEST_UPDATED', {
      connectionRequestUpdated: updated,
    });
  }

  /**
   * Adds or removes an FCM token for a user.
   */
  async manageFcmToken(
    userId: string,
    token: string,
    action: 'add' | 'remove',
  ): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { fcmTokens: true },
    });
    if (!user) return false;

    if (action === 'add') {
      if (user.fcmTokens.includes(token)) return true;
      await this.prisma.user.update({
        where: { id: userId },
        data: { fcmTokens: { push: token } },
      });
      return true;
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { fcmTokens: { set: user.fcmTokens.filter((t) => t !== token) } },
    });
    return true;
  }

  private async _generateUniqueSlug(
    baseName: string,
    idToExclude: string | null = null,
  ): Promise<string> {
    const baseSlug = slugify(baseName, {
      lower: true,
      strict: true,
      remove: /[*+~.()'"!:@]/g,
    });
    let slug = baseSlug;
    let isUnique = false;

    while (!isUnique) {
      const existingUser = await this.prisma.user.findFirst({
        where: {
          slug,
          ...(idToExclude && { id: { not: idToExclude } }),
        },
        select: { id: true },
      });
      if (!existingUser) {
        isUnique = true;
      } else {
        slug = `${baseSlug}-${randomBytes(3).toString('hex')}`;
      }
    }
    return slug;
  }

  // --- Follow / Unfollow Methods (using FollowsService) ---

  async follow(followerId: string, followingId: string): Promise<void> {
    const [follower, following] = await Promise.all([
      this.findById(followerId),
      this.findById(followingId),
    ]);

    if (!follower || !following) {
      throw new NotFoundException('User not found');
    }

    await this.followsService.followUser(followerId, followingId);

    await this.notificationsService.create({
      recipients: [followingId],
      sender: followerId,
      type: NotificationType.NEW_FOLLOWER,
      entityId: followerId,
      onModel: 'User',
    });

    const followerCount = await this.followsService.getFollowersCount(followingId);
    const followingCount = await this.followsService.getFollowingCount(followerId);

    await this.pubSub.publish('followsUpdated', {
      followsUpdated: {
        follower: { userId: followerId, followingCount },
        following: { userId: followingId, followerCount },
      },
    });
  }

  async unfollow(followerId: string, followingId: string): Promise<void> {
    await this.followsService.unfollowUser(followerId, followingId);

    const followerCount = await this.followsService.getFollowersCount(followingId);
    const followingCount = await this.followsService.getFollowingCount(followerId);

    await this.pubSub.publish('followsUpdated', {
      followsUpdated: {
        follower: { userId: followerId, followingCount },
        following: { userId: followingId, followerCount },
      },
    });
  }

  // --- Block / Unblock Methods (using BlocksService) ---

  async blockUser(blockerId: string, blockedId: string): Promise<void> {
    const [blocker, blocked] = await Promise.all([
      this.findById(blockerId),
      this.findById(blockedId),
    ]);

    if (!blocker || !blocked) {
      throw new NotFoundException('User not found');
    }

    await this.blocksService.blockUser(blockerId, blockedId);
  }

  async unblockUser(blockerId: string, blockedId: string): Promise<void> {
    await this.blocksService.unblockUser(blockerId, blockedId);
  }
}
