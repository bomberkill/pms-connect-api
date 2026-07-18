import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Inject,
  ForbiddenException,
} from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { PrismaService } from '../prisma/prisma.service';
import { GroupMemberRole, GroupPrivacy } from '../../generated/prisma/enums';
import {
  GroupJoinRequestStatus,
} from '../../generated/prisma/enums';
import type { GroupJoinRequestModel } from '../../generated/prisma/models';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/schemas/notification.schema';
import { GroupsService } from './groups.service';
import { GetGroupJoinRequestsArgs } from './dto/get-join-requests.args';
import { PUB_SUB } from '../pubsub/pubsub.module';
import { GroupMembershipService } from './group-membership.service';
import { UsersService } from '../users/users.service';
import type { UserModel } from '../../generated/prisma/models';

// GroupJoinRequestGQL.user is an eagerly-embedded GraphQL field (no
// separate @ResolveField), so every request returned to a resolver must
// already carry the full User object — same reasoning as
// PopulatedGroupMembership in group-membership.service.ts.
export type PopulatedGroupJoinRequest = Omit<
  GroupJoinRequestModel,
  'userId'
> & { user: UserModel | null };

const WITH_GROUP = { group: true } as const;

@Injectable()
export class JoinGroupRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    @Inject(PUB_SUB) private readonly pubSub: PubSub,
    private readonly groupsService: GroupsService,
    private readonly membershipService: GroupMembershipService,
    private readonly usersService: UsersService,
  ) {}

  private async attachUsers(
    requests: GroupJoinRequestModel[],
  ): Promise<PopulatedGroupJoinRequest[]> {
    const userIds = [...new Set(requests.map((r) => r.userId))];
    const users = await this.usersService.findManyByIds(userIds);
    const usersById = new Map(users.map((u) => [u.id, u]));
    return requests.map(({ userId, ...rest }) => ({
      ...rest,
      user: usersById.get(userId) ?? null,
    }));
  }

  async sendJoinRequest(
    groupId: string,
    requesterId: string,
  ): Promise<GroupJoinRequestModel | null> {
    const group = await this.prisma.group.findUnique({ where: { id: groupId } });

    if (!group) {
      throw new NotFoundException(`Group with ID "${groupId}" not found.`);
    }

    const isMember = await this.membershipService.isMember(groupId, requesterId);
    if (isMember) {
      throw new ConflictException('You are already a member of this group.');
    }

    // If the group is public, add the member directly and skip the request process.
    if (group.privacy === GroupPrivacy.PUBLIC) {
      await this.groupsService.addMember(groupId, requesterId);
      // TODO: Notify user that they joined
      return null; // No request document is created
    }

    if (group.privacy === GroupPrivacy.SECRET) {
      throw new BadRequestException(
        'This group is secret and requires an invitation to join.',
      );
    }

    // For PRIVATE groups, create a join request.
    const existingRequest = await this.prisma.groupJoinRequest.findFirst({
      where: {
        groupId,
        userId: requesterId,
        status: GroupJoinRequestStatus.PENDING,
      },
    });

    if (existingRequest) {
      throw new ConflictException(
        'You already have a pending request to join this group.',
      );
    }

    const savedRequest = await this.prisma.groupJoinRequest.create({
      data: { groupId, userId: requesterId },
    });

    // Notify all group admins and moderators
    const adminAndModeratorIds = (
      await this.membershipService.getMembersByRoles(groupId, [
        GroupMemberRole.ADMIN,
        GroupMemberRole.MODERATOR,
      ])
    ).map((membership) => membership.user!.id);

    if (adminAndModeratorIds.length > 0) {
      this.notificationsService.create({
        recipients: adminAndModeratorIds,
        sender: requesterId,
        type: NotificationType.GROUP_JOIN_REQUEST,
        entityId: group.id,
        onModel: 'Group',
      });
    }

    // TODO: Publish PubSub event
    // this.pubSub.publish(...)

    return savedRequest;
  }

  /**
   * Allows an admin/moderator to invite or directly add a user to a group.
   * - PUBLIC: Adds the user directly.
   * - PRIVATE: Creates an 'INVITED' request for the user to accept.
   * - SECRET: Adds the user directly.
   * @param groupId The ID of the group.
   * @param userIdToInvite The ID of the user to invite/add.
   * @param currentUserId The ID of the user performing the action (must be admin/mod).
   */
  async inviteUserToGroup(
    groupId: string,
    userIdToInvite: string,
    currentUserId: string,
  ): Promise<GroupJoinRequestModel | null> {
    const group = await this.prisma.group.findUnique({ where: { id: groupId } });
    if (!group) {
      throw new NotFoundException(`Group with ID "${groupId}" not found.`);
    }

    // 1. Check if the current user is an admin or moderator
    const currentUserMember = await this.membershipService.getMembership(
      groupId,
      currentUserId,
    );
    if (
      !currentUserMember ||
      currentUserMember.role === GroupMemberRole.MEMBER
    ) {
      throw new ForbiddenException(
        'You must be an admin or moderator to invite users.',
      );
    }

    // 2. Check if the user to invite is already a member
    const isAlreadyMember = await this.membershipService.isMember(
      groupId,
      userIdToInvite,
    );
    if (isAlreadyMember) {
      throw new ConflictException(
        'This user is already a member of the group.',
      );
    }

    // 3. Handle based on group privacy
    if (
      group.privacy === GroupPrivacy.PUBLIC ||
      group.privacy === GroupPrivacy.SECRET
    ) {
      // Directly add the member
      await this.groupsService.addMember(groupId, userIdToInvite);
      // TODO: Notify the added user
      return null; // No request document is created
    }

    // For PRIVATE groups, create an invitation request
    const existingRequest = await this.prisma.groupJoinRequest.findFirst({
      where: {
        groupId,
        userId: userIdToInvite,
        status: {
          in: [GroupJoinRequestStatus.PENDING, GroupJoinRequestStatus.INVITED],
        },
      },
    });

    if (existingRequest) {
      throw new ConflictException(
        'This user already has a pending request or invitation for this group.',
      );
    }

    const savedRequest = await this.prisma.groupJoinRequest.create({
      data: {
        groupId,
        userId: userIdToInvite,
        status: GroupJoinRequestStatus.INVITED, // Mark as an invitation
      },
    });

    // Notify the invited user
    this.notificationsService.create({
      recipients: [userIdToInvite],
      sender: currentUserId,
      type: NotificationType.GROUP_INVITATION,
      entityId: group.id,
      onModel: 'Group',
    });

    return savedRequest;
  }

  async acceptJoinRequest(requestId: string, adminId: string): Promise<void> {
    const request = await this.prisma.groupJoinRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException('Join request not found.');
    }

    const group = await this.prisma.group.findUnique({ where: { id: request.groupId } });
    if (!group) {
      throw new NotFoundException('Group not found.');
    }

    const adminMember = await this.membershipService.getMembership(
      group.id,
      adminId,
    );

    if (!adminMember || adminMember.role === GroupMemberRole.MEMBER) {
      throw new ForbiddenException(
        'You must be an admin or moderator to accept requests.',
      );
    }

    if (request.status !== GroupJoinRequestStatus.PENDING) {
      throw new ConflictException(
        `This request is already ${request.status.toLowerCase()}.`,
      );
    }

    // Add user to group
    await this.groupsService.addMember(group.id, request.userId);

    await this.prisma.groupJoinRequest.update({
      where: { id: requestId },
      data: { status: GroupJoinRequestStatus.APPROVED },
    });

    // Notify the user that their request was accepted
    this.notificationsService.create({
      recipients: [request.userId],
      sender: adminId,
      type: NotificationType.GROUP_JOIN_REQUEST_ACCEPTED,
      entityId: group.id,
      onModel: 'Group',
    });

    // TODO: Publish PubSub event
    // this.pubSub.publish(...)
  }

  async rejectJoinRequest(requestId: string, adminId: string): Promise<void> {
    const request = await this.prisma.groupJoinRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) {
      throw new NotFoundException('Join request not found.');
    }

    const group = await this.prisma.group.findUnique({ where: { id: request.groupId } });
    if (!group) {
      throw new NotFoundException('Group not found.');
    }

    const adminMember = await this.membershipService.getMembership(
      group.id,
      adminId,
    );
    if (!adminMember || adminMember.role === GroupMemberRole.MEMBER) {
      throw new ForbiddenException(
        'You must be an admin or moderator to reject requests.',
      );
    }

    if (request.status !== GroupJoinRequestStatus.PENDING) {
      throw new ConflictException(
        `This request is already ${request.status.toLowerCase()}.`,
      );
    }

    await this.prisma.groupJoinRequest.update({
      where: { id: requestId },
      data: { status: GroupJoinRequestStatus.REJECTED },
    });
  }

  async adminApproveJoinRequest(requestId: string): Promise<void> {
    const request = await this.prisma.groupJoinRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) {
      throw new NotFoundException('Join request not found.');
    }

    if (request.status !== GroupJoinRequestStatus.PENDING) {
      throw new ConflictException(
        `This request is already ${request.status.toLowerCase()}.`,
      );
    }

    const group = await this.prisma.group.findUnique({ where: { id: request.groupId } });
    if (!group) {
      throw new NotFoundException('Group not found.');
    }

    await this.groupsService.addMember(group.id, request.userId);

    await this.prisma.groupJoinRequest.update({
      where: { id: requestId },
      data: { status: GroupJoinRequestStatus.APPROVED },
    });
  }

  async adminRejectJoinRequest(requestId: string): Promise<void> {
    const request = await this.prisma.groupJoinRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) {
      throw new NotFoundException('Join request not found.');
    }

    if (request.status !== GroupJoinRequestStatus.PENDING) {
      throw new ConflictException(
        `This request is already ${request.status.toLowerCase()}.`,
      );
    }

    const group = await this.prisma.group.findUnique({ where: { id: request.groupId } });
    if (!group) {
      throw new NotFoundException('Group not found.');
    }

    await this.prisma.groupJoinRequest.update({
      where: { id: requestId },
      data: { status: GroupJoinRequestStatus.REJECTED },
    });
  }

  async cancelJoinRequest(requestId: string, requesterId: string): Promise<void> {
    const request = await this.prisma.groupJoinRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) {
      throw new NotFoundException('Join request not found.');
    }

    if (request.userId !== requesterId) {
      throw new ForbiddenException('You can only cancel your own requests.');
    }

    if (request.status !== GroupJoinRequestStatus.PENDING) {
      throw new ConflictException(
        `This request is already ${request.status.toLowerCase()}.`,
      );
    }

    await this.prisma.groupJoinRequest.update({
      where: { id: requestId },
      data: { status: GroupJoinRequestStatus.CANCELLED },
    });
  }

  async acceptGroupInvitation(
    requestId: string,
    currentUserId: string,
  ): Promise<void> {
    const invitation = await this.prisma.groupJoinRequest.findUnique({
      where: { id: requestId },
    });
    if (!invitation) {
      throw new NotFoundException('Group invitation not found.');
    }

    if (invitation.userId !== currentUserId) {
      throw new ForbiddenException(
        'You can only accept your own invitations.',
      );
    }

    if (invitation.status !== GroupJoinRequestStatus.INVITED) {
      throw new ConflictException(
        `This invitation is already ${invitation.status.toLowerCase()}.`,
      );
    }

    await this.groupsService.addMember(invitation.groupId, currentUserId);

    await this.prisma.groupJoinRequest.update({
      where: { id: requestId },
      data: { status: GroupJoinRequestStatus.APPROVED },
    });
  }

  async declineGroupInvitation(
    requestId: string,
    currentUserId: string,
  ): Promise<void> {
    const invitation = await this.prisma.groupJoinRequest.findUnique({
      where: { id: requestId },
    });
    if (!invitation) {
      throw new NotFoundException('Group invitation not found.');
    }

    if (invitation.userId !== currentUserId) {
      throw new ForbiddenException(
        'You can only decline your own invitations.',
      );
    }

    if (invitation.status !== GroupJoinRequestStatus.INVITED) {
      throw new ConflictException(
        `This invitation is already ${invitation.status.toLowerCase()}.`,
      );
    }

    await this.prisma.groupJoinRequest.update({
      where: { id: requestId },
      data: { status: GroupJoinRequestStatus.REJECTED },
    });
  }

  /**
   * Finds join requests for a specific group, typically for admins.
   */
  async findRequestsForGroup(
    groupId: string,
    currentUserId: string,
    status: GroupJoinRequestStatus = GroupJoinRequestStatus.PENDING,
  ): Promise<PopulatedGroupJoinRequest[]> {
    // Permission check: ensure the current user is an admin of the group.
    const group = await this.prisma.group.findUnique({ where: { id: groupId } });
    if (!group) {
      throw new NotFoundException('Group not found.');
    }
    const member = await this.membershipService.getMembership(
      groupId,
      currentUserId,
    );
    if (!member || member.role === 'MEMBER') {
      throw new ForbiddenException(
        'You must be an admin or moderator to view join requests.',
      );
    }

    const requests = await this.prisma.groupJoinRequest.findMany({
      where: { groupId, status },
      include: WITH_GROUP,
      orderBy: { createdAt: 'desc' },
    });
    return this.attachUsers(requests);
  }

  /**
   * Finds all join requests with pagination and filtering.
   */
  async findAll(
    args: GetGroupJoinRequestsArgs,
  ): Promise<PopulatedGroupJoinRequest[]> {
    const { skip, limit, groupId, status } = args;

    const requests = await this.prisma.groupJoinRequest.findMany({
      where: {
        ...(groupId && { groupId }),
        ...(status && { status }),
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: WITH_GROUP,
    });
    return this.attachUsers(requests);
  }

  async findRequestsForUser(
    userId: string,
    args: {
      skip: number;
      limit: number;
      groupId?: string;
      status?: GroupJoinRequestStatus;
    },
  ): Promise<PopulatedGroupJoinRequest[]> {
    const { skip, limit, groupId, status } = args;

    const requests = await this.prisma.groupJoinRequest.findMany({
      where: {
        userId,
        ...(groupId && { groupId }),
        ...(status && { status }),
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: WITH_GROUP,
    });
    return this.attachUsers(requests);
  }
}
