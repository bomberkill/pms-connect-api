import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BlocksService {
  constructor(private readonly prisma: PrismaService) {}

  async blockUser(blockerId: string, blockedId: string) {
    if (blockerId === blockedId) {
      throw new ConflictException('You cannot block yourself');
    }

    try {
      return await this.prisma.block.create({
        data: { blockerId, blockedId },
      });
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException('Already blocking this user');
      }
      throw error;
    }
  }

  async unblockUser(blockerId: string, blockedId: string): Promise<boolean> {
    try {
      await this.prisma.block.delete({
        where: { blockerId_blockedId: { blockerId, blockedId } },
      });
      return true;
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException('Block relationship not found');
      }
      throw error;
    }
  }

  /**
   * Ids of users this user has blocked.
   */
  async getBlockedIds(userId: string): Promise<string[]> {
    const blocks = await this.prisma.block.findMany({
      where: { blockerId: userId },
      select: { blockedId: true },
    });
    return blocks.map((b) => b.blockedId);
  }

  /**
   * Ids of users who have blocked this user.
   */
  async getBlockedByIds(userId: string): Promise<string[]> {
    const blocks = await this.prisma.block.findMany({
      where: { blockedId: userId },
      select: { blockerId: true },
    });
    return blocks.map((b) => b.blockerId);
  }

  /**
   * Union of both directions — used to filter content out of a user's
   * feed. A block is treated as mutually hiding: you don't see posts
   * from someone you've blocked, or from someone who's blocked you.
   */
  async getMutualBlockIds(userId: string): Promise<string[]> {
    const [blocked, blockedBy] = await Promise.all([
      this.getBlockedIds(userId),
      this.getBlockedByIds(userId),
    ]);
    return [...new Set([...blocked, ...blockedBy])];
  }
}
