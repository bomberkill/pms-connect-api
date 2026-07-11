import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery } from 'mongoose';
import slugify from 'slugify';
import { randomBytes } from 'crypto';
import {
  Group,
  GroupDocument,
  GroupMemberRole,
  GroupPrivacy,
} from './schemas/group.schema';
import {
  GroupJoinRequest,
  GroupJoinRequestDocument,
} from './schemas/group-join-request.schema';
import { CreateGroupInput } from './dto/create-group.input';
import { GetGroupsArgs } from './dto/get-groups.args';
import { UpdateGroupInput } from './dto/update-group.input';
import { UserDocument } from '../users/schemas/users.schema';
import { GroupMembershipService } from './group-membership.service';
import { GroupMembershipDocument } from './schemas/group-membership.schema';
import {
  CurrentUserType,
  isAdminUser,
} from '../auth/decorators/current-user.decorator';

@Injectable()
export class GroupsService {
  constructor(
    @InjectModel(Group.name) private groupModel: Model<GroupDocument>,
    @InjectModel(GroupJoinRequest.name)
    private joinRequestModel: Model<GroupJoinRequestDocument>,
    private readonly membershipService: GroupMembershipService,
  ) {}

  async create(
    createGroupInput: CreateGroupInput,
    creator: UserDocument,
  ): Promise<GroupDocument> {
    const { name, description, privacy } = createGroupInput;

    // 1. Generate a unique slug
    const slug = await this._generateUniqueSlug(name);

    // 2. Create the new group document (without members array)
    const newGroup = new this.groupModel({
      name,
      slug,
      description,
      privacy,
      creator: creator._id,
    });

    const savedGroup = await newGroup.save();

    // 3. Add the creator as the first member with ADMIN role using GroupMembershipService
    await this.membershipService.addMember(
      savedGroup._id.toString(),
      creator._id.toString(),
      GroupMemberRole.ADMIN,
    );

    return savedGroup;
  }

  private async _generateUniqueSlug(baseName: string): Promise<string> {
    const baseSlug = slugify(baseName, { lower: true, strict: true });
    let slug = baseSlug;
    let isUnique = false;
    while (!isUnique) {
      const existingGroup = await this.groupModel
        .findOne({ slug })
        .select('_id')
        .lean();
      if (!existingGroup) isUnique = true;
      else slug = `${baseSlug}-${randomBytes(3).toString('hex')}`;
    }
    return slug;
  }

  /**
   * Finds a single group by its slug.
   * It populates the creator and the user within each member.
   * @param slug The unique slug of the group.
   * @returns A group document or null.
   */
  async findBySlug(slug: string): Promise<GroupDocument | null> {
    // We use .populate() to replace the user IDs with the full user documents,
    // which is crucial for the GraphQL resolver to return the complete GroupGQL object.
    return this.groupModel.findOne({ slug }).exec();
  }

  /**
   * Finds a single group by its ID.
   * It populates the creator and the user within each member.
   * @param id The ID of the group.
   * @returns A group document or null.
   */
  async findGroupById(id: string): Promise<GroupDocument | null> {
    return this.groupModel.findById(id).exec();
  }

  /**
   * Guards group *content* (members, posts) rather than the group's own
   * metadata: for PRIVATE/SECRET groups, only members and admins may view
   * the member list or post feed. Basic group metadata (name, description,
   * member count) stays visible to any authenticated caller via
   * findBySlug/findGroupById — only content behind this check is gated.
   */
  async assertCanViewGroupContent(
    groupId: string,
    viewer: CurrentUserType | null | undefined,
  ): Promise<GroupDocument> {
    const group = await this.groupModel.findById(groupId);
    if (!group) {
      throw new NotFoundException(`Group with ID "${groupId}" not found.`);
    }
    if (group.privacy === GroupPrivacy.PUBLIC || isAdminUser(viewer)) {
      return group;
    }
    if (!viewer || !('_id' in viewer)) {
      throw new ForbiddenException(
        'You must be a member of this group to view its content.',
      );
    }
    const isMember = await this.membershipService.isMember(
      groupId,
      viewer._id.toString(),
    );
    if (!isMember) {
      throw new ForbiddenException(
        'You must be a member of this group to view its content.',
      );
    }
    return group;
  }

  /**
   * Updates a group's details.
   * @param groupId The ID of the group to update.
   * @param updateGroupInput The new data for the group.
   * @returns The updated group document.
   */
  async update(
    groupId: string,
    currentUserId: string,
    updateGroupInput: UpdateGroupInput,
  ): Promise<GroupDocument> {
    // 1. Fetch the group first to check permissions
    const group = await this.groupModel.findById(groupId);
    if (!group) {
      throw new NotFoundException(`Group with ID "${groupId}" not found.`);
    }

    // 2. Check if the current user is an admin of the group
    const member = await this.membershipService.getMembership(
      groupId,
      currentUserId,
    );

    if (!member || member.role !== GroupMemberRole.ADMIN) {
      throw new ForbiddenException(
        'You must be an admin to update this group.',
      );
    }

    const updatePayload: Partial<UpdateGroupInput> & { slug?: string } = {
      ...updateGroupInput,
    };
    // If name is changing, regenerate the slug
    if (updateGroupInput.name) {
      updatePayload.slug = await this._generateUniqueSlug(
        updateGroupInput.name,
      );
    }

    const updatedGroup = await this.groupModel
      .findByIdAndUpdate(groupId, { $set: updatePayload }, { new: true })
      .exec();

    if (!updatedGroup) {
      throw new NotFoundException(`Group with ID "${groupId}" not found.`);
    }

    return updatedGroup;
  }

  async adminUpdate(
    groupId: string,
    updateGroupInput: UpdateGroupInput,
  ): Promise<GroupDocument> {
    const group = await this.groupModel.findById(groupId);
    if (!group) {
      throw new NotFoundException(`Group with ID "${groupId}" not found.`);
    }

    const updatePayload: Partial<UpdateGroupInput> & { slug?: string } = {
      ...updateGroupInput,
    };

    if (updateGroupInput.name) {
      updatePayload.slug = await this._generateUniqueSlug(
        updateGroupInput.name,
      );
    }

    const updatedGroup = await this.groupModel
      .findByIdAndUpdate(groupId, { $set: updatePayload }, { new: true })
      .exec();

    if (!updatedGroup) {
      throw new NotFoundException(`Group with ID "${groupId}" not found.`);
    }

    return updatedGroup;
  }

  /**
   * Adds a member to a group using GroupMembershipService.
   * @param groupId The ID of the group.
   * @param userIdToAdd The ID of the user to add.
   * @returns The updated group document.
   */
  async addMember(
    groupId: string,
    userIdToAdd: string,
  ): Promise<GroupDocument> {
    // Verify group exists
    const group = await this.groupModel.findById(groupId);
    if (!group) {
      throw new NotFoundException(`Group with ID "${groupId}" not found.`);
    }

    // Use GroupMembershipService to add member
    await this.membershipService.addMember(
      groupId,
      userIdToAdd,
      GroupMemberRole.MEMBER,
    );

    return group;
  }

  /**
   * Removes a member from a group using GroupMembershipService.
   * @param groupId The ID of the group.
   * @param userIdToRemove The ID of the user to remove.
   * @param currentUserId The ID of the user performing the action.
   * @returns The updated group document.
   */
  async removeMember(
    groupId: string,
    currentUserId: string,
    userIdToRemove?: string,
  ): Promise<GroupDocument> {
    const group = await this.groupModel.findById(groupId);
    if (!group) {
      throw new NotFoundException(`Group with ID "${groupId}" not found.`);
    }

    const finalUserIdToRemove = userIdToRemove || currentUserId;

    // Check if user to remove is a member
    const memberToRemove = await this.membershipService.getMembership(
      groupId,
      finalUserIdToRemove,
    );
    if (!memberToRemove) {
      throw new NotFoundException('User is not a member of this group.');
    }

    // A user is trying to remove someone else
    if (userIdToRemove && userIdToRemove !== currentUserId) {
      const currentUserMember = await this.membershipService.getMembership(
        groupId,
        currentUserId,
      );

      if (!currentUserMember) {
        throw new ForbiddenException('You are not a member of this group.');
      }

      const roleHierarchy = {
        [GroupMemberRole.ADMIN]: 2,
        [GroupMemberRole.MODERATOR]: 1,
        [GroupMemberRole.MEMBER]: 0,
      };

      const currentUserRoleLevel = roleHierarchy[currentUserMember.role];
      const memberToRemoveRoleLevel = roleHierarchy[memberToRemove.role];

      // A user can only remove someone with a strictly lower role
      if (currentUserRoleLevel <= memberToRemoveRoleLevel) {
        throw new ForbiddenException(
          'You do not have sufficient permissions to remove this member.',
        );
      }

      // Specific rule: Only the creator can remove an admin
      if (
        memberToRemove.role === GroupMemberRole.ADMIN &&
        group.creator.toString() !== currentUserId
      ) {
        throw new ForbiddenException(
          'Only the group creator can remove an administrator.',
        );
      }
    }
    // A user is trying to leave the group
    else {
      if (group.creator.toString() === currentUserId) {
        throw new ForbiddenException(
          'The creator cannot leave the group. You must delete it instead.',
        );
      }
    }

    // The creator can never be removed from the group by anyone.
    if (group.creator.toString() === finalUserIdToRemove) {
      throw new BadRequestException('The group creator cannot be removed.');
    }

    // Use GroupMembershipService to remove member
    await this.membershipService.removeMember(groupId, finalUserIdToRemove);

    return group;
  }

  async updateMemberRole(
    groupId: string,
    currentUserId: string,
    userIdToUpdate: string,
    newRole: GroupMemberRole,
  ): Promise<GroupMembershipDocument> {
    const group = await this.groupModel.findById(groupId);
    if (!group) {
      throw new NotFoundException(`Group with ID "${groupId}" not found.`);
    }

    const currentUserMembership = await this.membershipService.getMembership(
      groupId,
      currentUserId,
    );
    if (!currentUserMembership || currentUserMembership.role !== GroupMemberRole.ADMIN) {
      throw new ForbiddenException(
        'You must be an admin to update a member role.',
      );
    }

    if (group.creator.toString() === userIdToUpdate) {
      throw new BadRequestException(
        'The group creator role cannot be changed.',
      );
    }

    const targetMembership = await this.membershipService.getMembership(
      groupId,
      userIdToUpdate,
    );
    if (!targetMembership) {
      throw new NotFoundException('User is not a member of this group.');
    }

    return this.membershipService.updateMemberRole(
      groupId,
      userIdToUpdate,
      newRole,
    );
  }

  async adminRemoveMember(
    groupId: string,
    userIdToRemove: string,
  ): Promise<GroupDocument> {
    const group = await this.groupModel.findById(groupId);
    if (!group) {
      throw new NotFoundException(`Group with ID "${groupId}" not found.`);
    }

    if (group.creator.toString() === userIdToRemove) {
      throw new BadRequestException('The group creator cannot be removed.');
    }

    const membership = await this.membershipService.getMembership(
      groupId,
      userIdToRemove,
    );
    if (!membership) {
      throw new NotFoundException('User is not a member of this group.');
    }

    await this.membershipService.removeMember(groupId, userIdToRemove);

    return group;
  }

  async adminUpdateMemberRole(
    groupId: string,
    userIdToUpdate: string,
    newRole: GroupMemberRole,
  ): Promise<GroupMembershipDocument> {
    const group = await this.groupModel.findById(groupId);
    if (!group) {
      throw new NotFoundException(`Group with ID "${groupId}" not found.`);
    }

    if (group.creator.toString() === userIdToUpdate) {
      throw new BadRequestException(
        'The group creator role cannot be changed.',
      );
    }

    const membership = await this.membershipService.getMembership(
      groupId,
      userIdToUpdate,
    );
    if (!membership) {
      throw new NotFoundException('User is not a member of this group.');
    }

    return this.membershipService.updateMemberRole(
      groupId,
      userIdToUpdate,
      newRole,
    );
  }

  async delete(groupId: string, currentUserId: string): Promise<boolean> {
    const group = await this.groupModel.findById(groupId);
    if (!group) {
      throw new NotFoundException(`Group with ID "${groupId}" not found.`);
    }

    if (group.creator.toString() !== currentUserId) {
      throw new ForbiddenException('Only the group creator can delete this group.');
    }

    await this.membershipService.removeAllMembers(groupId);
    await this.joinRequestModel.deleteMany({ group: groupId });
    await this.groupModel.deleteOne({ _id: groupId });

    return true;
  }

  async adminDelete(groupId: string): Promise<boolean> {
    const group = await this.groupModel.findById(groupId);
    if (!group) {
      throw new NotFoundException(`Group with ID "${groupId}" not found.`);
    }

    await this.membershipService.removeAllMembers(groupId);
    await this.joinRequestModel.deleteMany({ group: groupId });
    await this.groupModel.deleteOne({ _id: groupId });

    return true;
  }

  /**
   * Finds all groups with pagination and filtering.
   * @param args Pagination and filter arguments.
   * @returns A list of group documents.
   */
  async findAll(
    args: GetGroupsArgs,
    viewer?: CurrentUserType | null,
  ): Promise<GroupDocument[]> {
    const { skip, limit, search, privacy } = args;
    const filters: FilterQuery<GroupDocument> = {};

    if (search) {
      filters.name = { $regex: search, $options: 'i' };
    }

    if (privacy) {
      filters.privacy = privacy;
    }

    // SECRET groups are discoverable only by their members (or an admin) —
    // exclude them from the general listing for everyone else.
    if (!isAdminUser(viewer)) {
      const memberGroupIds =
        viewer && '_id' in viewer
          ? await this.membershipService.getUserGroupIds(
              viewer._id.toString(),
            )
          : [];
      filters.$or = [
        { privacy: { $ne: GroupPrivacy.SECRET } },
        { _id: { $in: memberGroupIds } },
      ];
    }

    return this.groupModel
      .find(filters)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();
  }
}
