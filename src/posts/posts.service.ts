import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PostStatus, MediaType } from '../../generated/prisma/enums';
import type { Prisma } from '../../generated/prisma/client';
import { CreatePostInput } from './dto/create-post.input';
import { PaginationArgs } from './dto/pagination.args';
import { UpdatePostInput } from './dto/update-post.input';
import { CommentsService } from './comments.service';

// Media used to be an embedded Mongoose array (always present on every
// fetched Post, no populate needed) — it's a separate Prisma table now, so
// every query that returns a Post to a caller needs this to match the old
// always-embedded behavior.
const WITH_MEDIA = { media: true } as const;

@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly commentsService: CommentsService,
  ) {}

  async create(createPostInput: CreatePostInput, authorId: string) {
    const { media, ...rest } = createPostInput;
    const data: Prisma.PostUncheckedCreateInput = {
      ...rest,
      authorId,
      // Validated against the ['IMAGE','VIDEO','DOCUMENT'] enum values by
      // class-validator on the DTO; the field is just typed as `string`
      // there, so it needs a cast to Prisma's literal MediaType union.
      ...(media && {
        media: {
          create: media.map((m) => ({ ...m, type: m.type as MediaType })),
        },
      }),
    };
    return this.prisma.post.create({ data, include: WITH_MEDIA });
  }

  async findManyByIds(ids: readonly string[]) {
    return this.prisma.post.findMany({
      where: { id: { in: [...ids] } },
      include: WITH_MEDIA,
    });
  }

  async findOne(id: string, includeArchived = false) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      include: WITH_MEDIA,
    });
    if (!post || (!includeArchived && post.status === PostStatus.ARCHIVED)) {
      throw new NotFoundException(`Post with ID "${id}" not found.`);
    }
    return post;
  }

  async update(id: string, userId: string, updatePostInput: UpdatePostInput) {
    const post = await this.prisma.post.findUnique({ where: { id } });
    if (!post) {
      throw new NotFoundException(`Post with ID "${id}" not found.`);
    }
    if (post.authorId !== userId) {
      throw new ForbiddenException('You can only update your own posts.');
    }

    return this.prisma.post.update({
      where: { id },
      data: updatePostInput,
      include: WITH_MEDIA,
    });
  }

  async remove(id: string, userId: string): Promise<boolean> {
    const post = await this.prisma.post.findUnique({ where: { id } });
    if (!post) {
      throw new NotFoundException(`Post with ID "${id}" not found.`);
    }
    if (post.authorId !== userId) {
      throw new ForbiddenException('You can only delete your own posts.');
    }
    return this.softDeletePost(id);
  }

  /**
   * Finds posts from a list of author IDs to build a feed.
   */
  async findPostsByAuthors(
    authorIds: string[],
    paginationArgs: PaginationArgs,
    includeArchived = false,
  ) {
    const { skip, limit } = paginationArgs;
    return this.prisma.post.findMany({
      where: {
        authorId: { in: authorIds },
        ...(includeArchived ? {} : { status: PostStatus.PUBLISHED }),
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: WITH_MEDIA,
    });
  }

  /**
   * Finds the most popular authors based on likes received in the last 60 days.
   */
  async findPopularAuthors(limit = 20): Promise<string[]> {
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const grouped = await this.prisma.post.groupBy({
      by: ['authorId'],
      where: { createdAt: { gte: sixtyDaysAgo } },
      _sum: { likesCount: true },
      orderBy: { _sum: { likesCount: 'desc' } },
      take: limit,
    });

    return grouped.map((g) => g.authorId);
  }

  /**
   * Finds all posts on the platform, for general discovery.
   */
  async findAllPosts(paginationArgs: PaginationArgs, includeArchived = false) {
    const { skip, limit } = paginationArgs;
    return this.prisma.post.findMany({
      where: includeArchived ? {} : { status: PostStatus.PUBLISHED },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: WITH_MEDIA,
    });
  }

  /**
   * Counts new posts from a list of authors since a given post was seen.
   * Not currently called anywhere (commented out in the resolver) — kept
   * for parity, but now anchors on the reference post's createdAt rather
   * than a `_id > sincePostId` cursor: unlike Mongo ObjectIds, Prisma's
   * cuid ids aren't guaranteed to sort chronologically.
   */
  async countNewPostsByAuthors(
    authorIds: string[],
    sincePostId: string,
  ): Promise<number> {
    const sincePost = await this.prisma.post.findUnique({
      where: { id: sincePostId },
      select: { createdAt: true },
    });
    if (!sincePost) return 0;
    return this.prisma.post.count({
      where: {
        authorId: { in: authorIds },
        createdAt: { gt: sincePost.createdAt },
        status: PostStatus.PUBLISHED,
      },
    });
  }

  /**
   * Counts all new posts on the platform since a given date.
   */
  async countNewPosts(since: Date): Promise<number> {
    return this.prisma.post.count({
      where: { createdAt: { gt: since }, status: PostStatus.PUBLISHED },
    });
  }

  /**
   * Finds posts belonging to a specific group.
   */
  async findPostsByGroup(groupId: string, paginationArgs: PaginationArgs) {
    const { skip, limit } = paginationArgs;
    return this.prisma.post.findMany({
      where: { groupId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: WITH_MEDIA,
    });
  }

  async removeAsAdmin(id: string): Promise<boolean> {
    const post = await this.prisma.post.findUnique({ where: { id } });
    if (!post) {
      throw new NotFoundException(`Post with ID "${id}" not found.`);
    }
    return this.softDeletePost(id);
  }

  private async softDeletePost(id: string): Promise<boolean> {
    await this.prisma.post.update({
      where: { id },
      data: {
        status: PostStatus.ARCHIVED,
        content: '[This post has been deleted]',
      },
    });

    const topLevelComments = await this.commentsService.findCommentsByPost(
      id,
      { skip: 0, limit: Number.MAX_SAFE_INTEGER },
    );

    for (const comment of topLevelComments) {
      await this.commentsService.removeCommentAsAdmin(comment.id);
    }

    return true;
  }
}
