import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PostStatus, MediaType, GroupPrivacy } from '../../generated/prisma/enums';
import type { Prisma } from '../../generated/prisma/client';
import { CreatePostInput } from './dto/create-post.input';
import { PaginationArgs } from './dto/pagination.args';
import { UpdatePostInput } from './dto/update-post.input';
import { CommentsService } from './comments.service';
import { GroupsService } from '../groups/groups.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/schemas/notification.schema';

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
    private readonly groupsService: GroupsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(createPostInput: CreatePostInput, authorId: string) {
    const { media, ...rest } = createPostInput;

    // A group requiring approval always wins over any client-supplied
    // `status` — otherwise the approval gate would just be a suggestion.
    let status = rest.status as PostStatus | undefined;
    if (rest.groupId) {
      const group = await this.prisma.group.findUnique({
        where: { id: rest.groupId },
        select: { postsRequireApproval: true },
      });
      if (group?.postsRequireApproval) {
        status = PostStatus.PENDING;
      }
    }

    const data: Prisma.PostUncheckedCreateInput = {
      ...rest,
      ...(status && { status }),
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

  /**
   * Approves or rejects a pending group post. Caller must already be
   * confirmed as an admin/moderator of the post's group (see
   * GroupsService.assertCanModerateGroupPosts).
   */
  async moderate(
    postId: string,
    actorId: string,
    decision: 'APPROVED' | 'REJECTED',
  ): Promise<boolean> {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) {
      throw new NotFoundException(`Post with ID "${postId}" not found.`);
    }
    if (!post.groupId) {
      throw new ForbiddenException('This post does not belong to a group.');
    }
    await this.groupsService.assertCanModerateGroupPosts(post.groupId, actorId);

    if (post.status !== PostStatus.PENDING) {
      throw new ConflictException(
        `This post is already ${post.status.toLowerCase()}.`,
      );
    }

    await this.prisma.post.update({
      where: { id: postId },
      data: { status: decision === 'APPROVED' ? PostStatus.PUBLISHED : PostStatus.REJECTED },
    });

    this.notificationsService.create({
      recipients: [post.authorId],
      sender: actorId,
      type: decision === 'APPROVED' ? NotificationType.POST_APPROVED : NotificationType.POST_REJECTED,
      entityId: post.id,
      onModel: 'Post',
    });

    return true;
  }

  /**
   * Lists posts awaiting moderation in a group. Caller must be an
   * admin/moderator of the group.
   */
  async findPendingByGroup(
    groupId: string,
    actorId: string,
    paginationArgs: PaginationArgs,
  ) {
    await this.groupsService.assertCanModerateGroupPosts(groupId, actorId);
    const { skip, limit } = paginationArgs;
    return this.prisma.post.findMany({
      where: { groupId, status: PostStatus.PENDING },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: WITH_MEDIA,
    });
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

  /**
   * Lean lookup used by callers (e.g. CommentsResolver) that need to check
   * group-content visibility for a post without fetching the full row.
   */
  async findGroupIdForPost(postId: string): Promise<string | null> {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { groupId: true },
    });
    return post?.groupId ?? null;
  }

  /**
   * Restricts a post listing to items whose parent group (if any) is
   * visible to the viewer: posts with no group, posts in a PUBLIC group, or
   * posts in a group the viewer is actually a member of. Callers fetching
   * as an admin should bypass this filter entirely rather than pass a
   * viewerId (admins can already see everything, same as the archived-post
   * bypass below).
   */
  private groupVisibilityFilter(viewerId?: string): Prisma.PostWhereInput {
    return {
      OR: [
        { groupId: null },
        { group: { privacy: GroupPrivacy.PUBLIC } },
        ...(viewerId
          ? [{ group: { memberships: { some: { userId: viewerId } } } }]
          : []),
      ],
    };
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
    viewerId?: string,
    bypassGroupVisibility = false,
  ) {
    const { skip, limit } = paginationArgs;
    return this.prisma.post.findMany({
      where: {
        authorId: { in: authorIds },
        ...(includeArchived ? {} : { status: PostStatus.PUBLISHED }),
        ...(bypassGroupVisibility ? {} : this.groupVisibilityFilter(viewerId)),
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
  async findAllPosts(
    paginationArgs: PaginationArgs,
    includeArchived = false,
    viewerId?: string,
  ) {
    const { skip, limit } = paginationArgs;
    return this.prisma.post.findMany({
      where: includeArchived
        ? {}
        : { status: PostStatus.PUBLISHED, ...this.groupVisibilityFilter(viewerId) },
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
      where: { groupId, status: PostStatus.PUBLISHED },
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
