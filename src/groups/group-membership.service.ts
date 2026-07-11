import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  GroupMembership,
  GroupMembershipDocument,
} from './schemas/group-membership.schema';
import { GroupMemberRole } from './schemas/group.schema';
import { PaginationArgs } from '../posts/dto/pagination.args';

@Injectable()
export class GroupMembershipService {
  constructor(
    @InjectModel(GroupMembership.name)
    private membershipModel: Model<GroupMembershipDocument>,
  ) {}

  /**
   * Add a member to a group
   */
  async addMember(
    groupId: string,
    userId: string,
    role: GroupMemberRole = GroupMemberRole.MEMBER,
  ): Promise<GroupMembershipDocument> {
    try {
      const membership = new this.membershipModel({
        group: groupId,
        user: userId,
        role,
      });
      return await membership.save();
    } catch (error) {
      // Duplicate key error (already a member)
      if (error.code === 11000) {
        throw new ConflictException('User is already a member of this group');
      }
      throw error;
    }
  }

  /**
   * Remove a member from a group
   */
  async removeMember(groupId: string, userId: string): Promise<boolean> {
    const result = await this.membershipModel.deleteOne({
      group: groupId,
      user: userId,
    });

    if (result.deletedCount === 0) {
      throw new NotFoundException('Membership not found');
    }

    return true;
  }

  async removeAllMembers(groupId: string): Promise<void> {
    await this.membershipModel.deleteMany({ group: groupId });
  }

  /**
   * Get all members of a group with pagination
   */
  async getMembers(
    groupId: string,
    pagination: PaginationArgs,
  ): Promise<GroupMembershipDocument[]> {
    return this.membershipModel
      .find({ group: groupId })
      .sort({ joinedAt: 1 }) // Oldest members first
      .skip(pagination.skip)
      .limit(pagination.limit)
      .populate('user')
      .exec();
  }

  /**
   * Get members by role
   */
  async getMembersByRole(
    groupId: string,
    role: GroupMemberRole,
  ): Promise<GroupMembershipDocument[]> {
    return this.membershipModel
      .find({ group: groupId, role })
      .sort({ joinedAt: 1 })
      .populate('user')
      .exec();
  }

  async getMembersByRoles(
    groupId: string,
    roles: GroupMemberRole[],
  ): Promise<GroupMembershipDocument[]> {
    return this.membershipModel
      .find({ group: groupId, role: { $in: roles } })
      .sort({ joinedAt: 1 })
      .populate('user')
      .exec();
  }

  /**
   * Get member count for a group
   */
  async getMemberCount(groupId: string): Promise<number> {
    return this.membershipModel.countDocuments({ group: groupId });
  }

  /**
   * Check if user is a member of a group
   */
  async isMember(groupId: string, userId: string): Promise<boolean> {
    const membership = await this.membershipModel.findOne({
      group: groupId,
      user: userId,
    });
    return !!membership;
  }

  /**
   * Get user's membership in a group (includes role)
   */
  async getMembership(
    groupId: string,
    userId: string,
  ): Promise<GroupMembershipDocument | null> {
    return this.membershipModel
      .findOne({ group: groupId, user: userId })
      .populate('user')
      .exec();
  }

  async getMembershipWithGroup(
    groupId: string,
    userId: string,
  ): Promise<GroupMembershipDocument | null> {
    return this.membershipModel
      .findOne({ group: groupId, user: userId })
      .populate('user')
      .populate('group')
      .exec();
  }

  /**
   * Update member role
   */
  async updateMemberRole(
    groupId: string,
    userId: string,
    newRole: GroupMemberRole,
  ): Promise<GroupMembershipDocument> {
    const membership = await this.membershipModel
      .findOneAndUpdate(
        { group: groupId, user: userId },
        { role: newRole },
        { new: true },
      )
      .populate('user');

    if (!membership) {
      throw new NotFoundException('Membership not found');
    }

    return membership;
  }

  /**
   * Get all groups a user is a member of
   */
  async getUserGroups(
    userId: string,
    pagination: PaginationArgs,
  ): Promise<GroupMembershipDocument[]> {
    return this.membershipModel
      .find({ user: userId })
      .sort({ joinedAt: -1 }) // Most recent first
      .skip(pagination.skip)
      .limit(pagination.limit)
      .populate('group')
      .exec();
  }

  /**
   * Get count of groups a user is in
   */
  async getUserGroupCount(userId: string): Promise<number> {
    return this.membershipModel.countDocuments({ user: userId });
  }

  /**
   * Get the ids of every group a user is a member of (unbounded — used to
   * build query filters, not returned directly to clients).
   */
  async getUserGroupIds(userId: string): Promise<string[]> {
    const ids = await this.membershipModel.distinct('group', { user: userId });
    return ids.map((id) => id.toString());
  }

  /**
   * Check if user has a specific role in a group
   */
  async hasRole(
    groupId: string,
    userId: string,
    role: GroupMemberRole,
  ): Promise<boolean> {
    const membership = await this.membershipModel.findOne({
      group: groupId,
      user: userId,
      role,
    });
    return !!membership;
  }

  /**
   * Check if user is admin or moderator
   */
  async isAdminOrModerator(groupId: string, userId: string): Promise<boolean> {
    const membership = await this.membershipModel.findOne({
      group: groupId,
      user: userId,
      role: { $in: [GroupMemberRole.ADMIN, GroupMemberRole.MODERATOR] },
    });
    return !!membership;
  }
}
