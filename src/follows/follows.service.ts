import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Follow, FollowDocument } from './schemas/follow.schema';
import { PaginationArgs } from '../posts/dto/pagination.args';

@Injectable()
export class FollowsService {
  constructor(
    @InjectModel(Follow.name) private followModel: Model<FollowDocument>,
  ) {}

  /**
   * Follow a user
   */
  async followUser(
    followerId: string,
    followingId: string,
  ): Promise<FollowDocument> {
    // Prevent self-follow
    if (followerId === followingId) {
      throw new ConflictException('You cannot follow yourself');
    }

    try {
      const follow = new this.followModel({
        follower: followerId,
        following: followingId,
      });
      return await follow.save();
    } catch (error) {
      // Duplicate key error (already following)
      if (error.code === 11000) {
        throw new ConflictException('Already following this user');
      }
      throw error;
    }
  }

  /**
   * Unfollow a user
   */
  async unfollowUser(
    followerId: string,
    followingId: string,
  ): Promise<boolean> {
    const result = await this.followModel.deleteOne({
      follower: followerId,
      following: followingId,
    });

    if (result.deletedCount === 0) {
      throw new NotFoundException('Follow relationship not found');
    }

    return true;
  }

  /**
   * Get followers of a user (users who follow this user)
   */
  async getFollowers(
    userId: string,
    pagination: PaginationArgs,
  ): Promise<FollowDocument[]> {
    return this.followModel
      .find({ following: userId })
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .populate('follower')
      .exec();
  }

  /**
   * Get following of a user (users this user follows)
   */
  async getFollowing(
    userId: string,
    pagination: PaginationArgs,
  ): Promise<FollowDocument[]> {
    return this.followModel
      .find({ follower: userId })
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .populate('following')
      .exec();
  }

  /**
   * Get followers count
   */
  async getFollowersCount(userId: string): Promise<number> {
    return this.followModel.countDocuments({ following: userId });
  }

  /**
   * Get following count
   */
  async getFollowingCount(userId: string): Promise<number> {
    return this.followModel.countDocuments({ follower: userId });
  }

  /**
   * Check if user A follows user B
   */
  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    const follow = await this.followModel.findOne({
      follower: followerId,
      following: followingId,
    });
    return !!follow;
  }

  /**
   * Get list of user IDs that a user follows (for feed generation)
   */
  async getFollowingIds(userId: string): Promise<string[]> {
    const follows = await this.followModel
      .find({ follower: userId })
      .select('following')
      .lean()
      .exec();

    return follows.map((f) => f.following.toString());
  }

  /**
   * Get list of follower IDs (for notifications fanout)
   */
  async getFollowerIds(userId: string): Promise<string[]> {
    const follows = await this.followModel
      .find({ following: userId })
      .select('follower')
      .lean()
      .exec();

    return follows.map((f) => f.follower.toString());
  }
}
