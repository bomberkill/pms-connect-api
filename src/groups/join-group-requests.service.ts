import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Inject,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery } from 'mongoose';
import { PubSub } from 'graphql-subscriptions';
import {
  Group,
  GroupDocument,
  GroupMemberRole,
  GroupPrivacy,
} from './schemas/group.schema';
import {
  GroupJoinRequest,
  GroupJoinRequestDocument,
  GroupJoinRequestStatus,
} from './schemas/group-join-request.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/schemas/notification.schema';
import { GroupsService } from './groups.service';
import { GetGroupJoinRequestsArgs } from './dto/get-join-requests.args';
import { PUB_SUB } from '../pubsub/pubsub.module';

@Injectable()
export class JoinGroupRequestsService {
  constructor(
    @InjectModel(Group.name) private groupModel: Model<GroupDocument>,
    @InjectModel(GroupJoinRequest.name)
    private readonly joinRequestModel: Model<GroupJoinRequestDocument>,
    private readonly notificationsService: NotificationsService,
    @Inject(PUB_SUB) private readonly pubSub: PubSub,
    private readonly groupsService: GroupsService,
  ) {}

  async sendJoinRequest(
    groupId: string,
    requesterId: string,
  ): Promise<GroupJoinRequestDocument> {
    const group = await this.groupModel.findById(groupId);

    if (!group) {
      throw new NotFoundException(`Group with ID "${groupId}" not found.`);
    }

    const isMember = group.members.some(
      (m) => m.user.toString() === requesterId,
    );
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
    const existingRequest = await this.joinRequestModel.findOne({
      group: groupId,
      user: requesterId,
      status: GroupJoinRequestStatus.PENDING,
    });

    if (existingRequest) {
      throw new ConflictException(
        'You already have a pending request to join this group.',
      );
    }

    const newRequest = new this.joinRequestModel({
      group: groupId,
      user: requesterId,
    });

    const savedRequest = await newRequest.save();

    // Notify all group admins and moderators
    const adminAndModeratorIds = group.members
      .filter((m) => m.role !== GroupMemberRole.MEMBER)
      .map((m) => m.user.toString());

    if (adminAndModeratorIds.length > 0) {
      this.notificationsService.create({
        recipients: adminAndModeratorIds,
        sender: requesterId,
        type: NotificationType.GROUP_JOIN_REQUEST,
        entityId: group._id.toString(),
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
  ): Promise<GroupJoinRequestDocument | null> {
    const group = await this.groupModel.findById(groupId);
    if (!group) {
      throw new NotFoundException(`Group with ID "${groupId}" not found.`);
    }

    // 1. Check if the current user is an admin or moderator
    const currentUserMember = group.members.find(
      (m) => m.user.toString() === currentUserId,
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
    const isAlreadyMember = group.members.some(
      (m) => m.user.toString() === userIdToInvite,
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
    const existingRequest = await this.joinRequestModel.findOne({
      group: groupId,
      user: userIdToInvite,
      status: {
        $in: [GroupJoinRequestStatus.PENDING, GroupJoinRequestStatus.INVITED],
      },
    });

    if (existingRequest) {
      throw new ConflictException(
        'This user already has a pending request or invitation for this group.',
      );
    }

    const newRequest = new this.joinRequestModel({
      group: groupId,
      user: userIdToInvite,
      status: GroupJoinRequestStatus.INVITED, // Mark as an invitation
    });

    const savedRequest = await newRequest.save();

    // Notify the invited user
    this.notificationsService.create({
      recipients: [userIdToInvite],
      sender: currentUserId,
      type: NotificationType.GROUP_INVITATION, // Assurez-vous que ce type existe
      entityId: group._id.toString(),
      onModel: 'Group',
    });

    return savedRequest;
  }

  async acceptJoinRequest(requestId: string, adminId: string): Promise<void> {
    const request = await this.joinRequestModel.findById(requestId);

    if (!request) {
      throw new NotFoundException('Join request not found.');
    }

    const group = await this.groupModel.findById(request.group.toString());
    if (!group) {
      throw new NotFoundException('Group not found.');
    }

    const adminMember = group.members.find(
      (m) => m.user.toString() === adminId,
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
    await this.groupsService.addMember(
      group._id.toString(),
      request.user.toString(),
    );

    request.status = GroupJoinRequestStatus.APPROVED;
    await request.save();

    // Notify the user that their request was accepted
    this.notificationsService.create({
      recipients: [request.user.toString()],
      sender: adminId,
      type: NotificationType.GROUP_JOIN_REQUEST_ACCEPTED,
      entityId: group._id.toString(),
      onModel: 'Group',
    });

    // TODO: Publish PubSub event
    // this.pubSub.publish(...)
  }

  async declineOrCancelJoinRequest(
    requestId: string,
    currentUserId: string,
  ): Promise<void> {
    const request = await this.joinRequestModel.findById(requestId);

    if (!request) {
      throw new NotFoundException('Join request not found.');
    }

    const group = request.group;
    const isRequester = request.user.toString() === currentUserId;

    // We need to fetch the group to check member roles
    const groupDoc = await this.groupModel.findById(group.toString());
    if (!groupDoc) {
      throw new NotFoundException('Group not found for this request.');
    }

    const adminMember = groupDoc.members.find(
      (m) => m.user.toString() === currentUserId,
    );
    const isAdmin = adminMember && adminMember.role !== GroupMemberRole.MEMBER;

    if (!isRequester && !isAdmin) {
      throw new ForbiddenException(
        'You are not authorized to modify this request.',
      );
    }

    if (request.status !== GroupJoinRequestStatus.PENDING) {
      throw new ConflictException(
        `This request is already ${request.status.toLowerCase()}.`,
      );
    }

    if (isRequester) {
      request.status = GroupJoinRequestStatus.CANCELLED;
    } else if (isAdmin) {
      request.status = GroupJoinRequestStatus.REJECTED;
    }

    await request.save();

    // TODO: Publish PubSub event
    // this.pubSub.publish(...)
  }

  /**
   * Finds join requests for a specific group, typically for admins.
   */
  async findRequestsForGroup(
    groupId: string,
    currentUserId: string,
    status: GroupJoinRequestStatus = GroupJoinRequestStatus.PENDING,
  ): Promise<GroupJoinRequestDocument[]> {
    // Permission check: ensure the current user is an admin of the group.
    const group = await this.groupModel.findById(groupId);
    if (!group) {
      throw new NotFoundException('Group not found.');
    }
    const member = group.members.find(
      (m) => m.user.toString() === currentUserId,
    );
    if (!member || member.role === 'MEMBER') {
      throw new ForbiddenException(
        'You must be an admin or moderator to view join requests.',
      );
    }

    return this.joinRequestModel
      .find({ group: groupId, status })
      .populate('user')
      .populate({
        path: 'group',
        populate: {
          path: 'creator members.user',
        },
      })
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * Finds all join requests with pagination and filtering.
   */
  async findAll(
    args: GetGroupJoinRequestsArgs,
  ): Promise<GroupJoinRequestDocument[]> {
    const { skip, limit, groupId, status } = args;
    const filters: FilterQuery<GroupJoinRequestDocument> = {};

    if (groupId) {
      filters.group = groupId;
    }

    if (status) {
      filters.status = status;
    }

    return this.joinRequestModel
      .find(filters)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user')
      .populate('group')
      .exec();
  }
}
