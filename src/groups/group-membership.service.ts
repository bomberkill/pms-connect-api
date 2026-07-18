import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GroupMemberRole } from '../../generated/prisma/enums';
import type { GroupMembershipModel } from '../../generated/prisma/models';
import { PaginationArgs } from '../posts/dto/pagination.args';
import { UsersService } from '../users/users.service';
import type { UserModel } from '../../generated/prisma/models';

// GroupMembershipGQL.user is an eagerly-embedded GraphQL field (no separate
// @ResolveField), so every membership returned to a resolver must already
// carry the full User object — same contract the old `.populate('user')`
// calls provided. User lives in Postgres too now, but in a different table
// with no FK relation Prisma can traverse (it's a plain string column), so
// this still needs a manual attach step.
export type PopulatedGroupMembership = Omit<GroupMembershipModel, 'userId'> & {
  user: UserModel | null;
};

@Injectable()
export class GroupMembershipService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  private async attachUser(
    membership: GroupMembershipModel | null,
  ): Promise<PopulatedGroupMembership | null> {
    if (!membership) return null;
    const user = await this.usersService.findById(membership.userId);
    const { userId, ...rest } = membership;
    return { ...rest, user };
  }

  private async attachUsers(
    memberships: GroupMembershipModel[],
  ): Promise<PopulatedGroupMembership[]> {
    const userIds = [...new Set(memberships.map((m) => m.userId))];
    const users = await this.usersService.findManyByIds(userIds);
    const usersById = new Map(users.map((u) => [u.id, u]));
    return memberships.map(({ userId, ...rest }) => ({
      ...rest,
      user: usersById.get(userId) ?? null,
    }));
  }

  /**
   * Add a member to a group
   */
  async addMember(
    groupId: string,
    userId: string,
    role: GroupMemberRole = GroupMemberRole.MEMBER,
  ): Promise<GroupMembershipModel> {
    try {
      return await this.prisma.groupMembership.create({
        data: { groupId, userId, role },
      });
    } catch (error) {
      // Unique constraint violation — already a member.
      if (error.code === 'P2002') {
        throw new ConflictException('User is already a member of this group');
      }
      throw error;
    }
  }

  /**
   * Remove a member from a group
   */
  async removeMember(groupId: string, userId: string): Promise<boolean> {
    const result = await this.prisma.groupMembership.deleteMany({
      where: { groupId, userId },
    });

    if (result.count === 0) {
      throw new NotFoundException('Membership not found');
    }

    return true;
  }

  async removeAllMembers(groupId: string): Promise<void> {
    await this.prisma.groupMembership.deleteMany({ where: { groupId } });
  }

  /**
   * Get all members of a group with pagination
   */
  async getMembers(
    groupId: string,
    pagination: PaginationArgs,
  ): Promise<PopulatedGroupMembership[]> {
    const memberships = await this.prisma.groupMembership.findMany({
      where: { groupId },
      orderBy: { joinedAt: 'asc' }, // Oldest members first
      skip: pagination.skip,
      take: pagination.limit,
    });
    return this.attachUsers(memberships);
  }

  /**
   * Get members by role
   */
  async getMembersByRole(
    groupId: string,
    role: GroupMemberRole,
  ): Promise<PopulatedGroupMembership[]> {
    const memberships = await this.prisma.groupMembership.findMany({
      where: { groupId, role },
      orderBy: { joinedAt: 'asc' },
    });
    return this.attachUsers(memberships);
  }

  async getMembersByRoles(
    groupId: string,
    roles: GroupMemberRole[],
  ): Promise<PopulatedGroupMembership[]> {
    const memberships = await this.prisma.groupMembership.findMany({
      where: { groupId, role: { in: roles } },
      orderBy: { joinedAt: 'asc' },
    });
    return this.attachUsers(memberships);
  }

  /**
   * Get member count for a group
   */
  async getMemberCount(groupId: string): Promise<number> {
    return this.prisma.groupMembership.count({ where: { groupId } });
  }

  /**
   * Check if user is a member of a group
   */
  async isMember(groupId: string, userId: string): Promise<boolean> {
    const membership = await this.prisma.groupMembership.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    return !!membership;
  }

  /**
   * Get user's membership in a group (includes role)
   */
  async getMembership(
    groupId: string,
    userId: string,
  ): Promise<PopulatedGroupMembership | null> {
    const membership = await this.prisma.groupMembership.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    return this.attachUser(membership);
  }

  async getMembershipWithGroup(
    groupId: string,
    userId: string,
  ): Promise<PopulatedGroupMembership | null> {
    const membership = await this.prisma.groupMembership.findUnique({
      where: { groupId_userId: { groupId, userId } },
      include: { group: true },
    });
    return this.attachUser(membership);
  }

  /**
   * Update member role
   */
  async updateMemberRole(
    groupId: string,
    userId: string,
    newRole: GroupMemberRole,
  ): Promise<PopulatedGroupMembership> {
    try {
      const membership = await this.prisma.groupMembership.update({
        where: { groupId_userId: { groupId, userId } },
        data: { role: newRole },
      });
      return (await this.attachUser(membership))!;
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException('Membership not found');
      }
      throw error;
    }
  }

  /**
   * Get all groups a user is a member of
   */
  async getUserGroups(
    userId: string,
    pagination: PaginationArgs,
  ) {
    return this.prisma.groupMembership.findMany({
      where: { userId },
      orderBy: { joinedAt: 'desc' }, // Most recent first
      skip: pagination.skip,
      take: pagination.limit,
      include: { group: true },
    });
  }

  /**
   * Get count of groups a user is in
   */
  async getUserGroupCount(userId: string): Promise<number> {
    return this.prisma.groupMembership.count({ where: { userId } });
  }

  /**
   * Get the ids of every group a user is a member of (unbounded — used to
   * build query filters, not returned directly to clients).
   */
  async getUserGroupIds(userId: string): Promise<string[]> {
    const memberships = await this.prisma.groupMembership.findMany({
      where: { userId },
      select: { groupId: true },
    });
    return memberships.map((m) => m.groupId);
  }

  /**
   * Check if user has a specific role in a group
   */
  async hasRole(
    groupId: string,
    userId: string,
    role: GroupMemberRole,
  ): Promise<boolean> {
    const membership = await this.prisma.groupMembership.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    return membership?.role === role;
  }

  /**
   * Check if user is admin or moderator
   */
  async isAdminOrModerator(groupId: string, userId: string): Promise<boolean> {
    const membership = await this.prisma.groupMembership.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    return (
      membership?.role === GroupMemberRole.ADMIN ||
      membership?.role === GroupMemberRole.MODERATOR
    );
  }
}
