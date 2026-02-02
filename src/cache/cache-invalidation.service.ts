import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

@Injectable()
export class CacheInvalidationService {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: any) {}

  /**
   * Invalidate all caches related to a specific user
   */
  async invalidateUser(userId: string): Promise<void> {
    const keys = [
      `user:${userId}`,
      `posts:author:${userId}:*`,
      `followers:${userId}:*`,
      `following:${userId}:*`,
      `followers:count:${userId}`,
      `following:count:${userId}`,
    ];

    await Promise.all(keys.map((key) => this.deletePattern(key)));
  }

  /**
   * Invalidate all feed caches
   */
  async invalidateFeed(): Promise<void> {
    await this.deletePattern('feed:*');
  }

  /**
   * Invalidate a specific post and related caches
   */
  async invalidatePost(postId: string, authorId?: string): Promise<void> {
    const keys = [`post:${postId}`];

    if (authorId) {
      keys.push(`posts:author:${authorId}:*`);
    }

    // Also invalidate feed since post might appear there
    keys.push('feed:*');

    await Promise.all(keys.map((key) => this.deletePattern(key)));
  }

  /**
   * Invalidate follow-related caches for a user
   */
  async invalidateFollows(userId: string): Promise<void> {
    const keys = [
      `followers:${userId}:*`,
      `following:${userId}:*`,
      `followers:count:${userId}`,
      `following:count:${userId}`,
    ];

    await Promise.all(keys.map((key) => this.deletePattern(key)));
  }

  /**
   * Invalidate group-related caches
   */
  async invalidateGroup(groupId: string): Promise<void> {
    const keys = [
      `group:${groupId}`,
      `posts:group:${groupId}:*`,
      `group:members:${groupId}:*`,
    ];

    await Promise.all(keys.map((key) => this.deletePattern(key)));
  }

  /**
   * Clear all caches (use with caution)
   */
  async clearAll(): Promise<void> {
    await this.cacheManager.reset();
  }

  /**
   * Delete cache keys matching a pattern
   * Note: Pattern matching works with Redis, for in-memory cache it deletes exact key
   */
  private async deletePattern(pattern: string): Promise<void> {
    try {
      if (pattern.includes('*')) {
        // For Redis, we would use SCAN command
        // For in-memory cache, we just delete the exact key
        await this.cacheManager.del(pattern.replace('*', ''));
      } else {
        await this.cacheManager.del(pattern);
      }
    } catch (error) {
      console.error(
        `Failed to delete cache pattern ${pattern}:`,
        error.message,
      );
    }
  }
}
