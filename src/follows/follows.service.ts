import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationArgs } from '../posts/dto/pagination.args';

@Injectable()
export class FollowsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Follow a user
   */
  async followUser(followerId: string, followingId: string) {
    if (followerId === followingId) {
      throw new ConflictException('You cannot follow yourself');
    }

    try {
      return await this.prisma.follow.create({
        data: { followerId, followingId },
      });
    } catch (error) {
      // Unique constraint violation (already following)
      if (error.code === 'P2002') {
        throw new ConflictException('Already following this user');
      }
      throw error;
    }
  }

  /**
   * Unfollow a user
   */
  async unfollowUser(followerId: string, followingId: string): Promise<boolean> {
    try {
      await this.prisma.follow.delete({
        where: { followerId_followingId: { followerId, followingId } },
      });
      return true;
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException('Follow relationship not found');
      }
      throw error;
    }
  }

  /**
   * Get followers of a user (users who follow this user)
   */
  async getFollowers(userId: string, pagination: PaginationArgs) {
    const follows = await this.prisma.follow.findMany({
      where: { followingId: userId },
      orderBy: { createdAt: 'desc' },
      skip: pagination.skip,
      take: pagination.limit,
      include: { follower: true },
    });
    return follows.map((f) => f.follower);
  }

  /**
   * Get following of a user (users this user follows)
   */
  async getFollowing(userId: string, pagination: PaginationArgs) {
    const follows = await this.prisma.follow.findMany({
      where: { followerId: userId },
      orderBy: { createdAt: 'desc' },
      skip: pagination.skip,
      take: pagination.limit,
      include: { following: true },
    });
    return follows.map((f) => f.following);
  }

  /**
   * Get followers count
   */
  async getFollowersCount(userId: string): Promise<number> {
    return this.prisma.follow.count({ where: { followingId: userId } });
  }

  /**
   * Get following count
   */
  async getFollowingCount(userId: string): Promise<number> {
    return this.prisma.follow.count({ where: { followerId: userId } });
  }

  /**
   * Check if user A follows user B
   */
  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    const follow = await this.prisma.follow.findUnique({
      where: { followerId_followingId: { followerId, followingId } },
    });
    return !!follow;
  }

  /**
   * Get list of user IDs that a user follows (for feed generation)
   */
  async getFollowingIds(userId: string): Promise<string[]> {
    const follows = await this.prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });
    return follows.map((f) => f.followingId);
  }

  /**
   * Get list of follower IDs (for notifications fanout)
   */
  async getFollowerIds(userId: string): Promise<string[]> {
    const follows = await this.prisma.follow.findMany({
      where: { followingId: userId },
      select: { followerId: true },
    });
    return follows.map((f) => f.followerId);
  }
}
