import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReportStatus } from '../../generated/prisma/enums';
import { CreateReportInput } from './dto/create-report.input';
import { GroupsService } from '../groups/groups.service';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly groupsService: GroupsService,
  ) {}

  async create(input: CreateReportInput, reporterId: string) {
    const targets = [input.postId, input.commentId, input.reportedUserId].filter(Boolean);
    if (targets.length !== 1) {
      throw new BadRequestException(
        'Exactly one of postId, commentId, or reportedUserId must be set.',
      );
    }

    await this.prisma.report.create({
      data: {
        reporterId,
        postId: input.postId,
        commentId: input.commentId,
        reportedUserId: input.reportedUserId,
        reason: input.reason,
        details: input.details,
      },
    });

    return true;
  }

  /**
   * Lists reports whose target post/comment belongs to a given group.
   * Caller must be an admin/moderator of that group. Reports targeting a
   * user directly (no post/comment) aren't group-scoped, so they're out
   * of this query's reach — platform-wide moderation is a separate,
   * not-yet-built concern.
   */
  async findForGroup(
    groupId: string,
    actorId: string,
    status?: ReportStatus,
  ) {
    await this.groupsService.assertCanModerateGroupPosts(groupId, actorId);

    return this.prisma.report.findMany({
      where: {
        ...(status && { status }),
        OR: [
          { post: { groupId } },
          { comment: { post: { groupId } } },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async resolve(reportId: string, actorId: string, status: ReportStatus): Promise<boolean> {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      include: { post: true, comment: { include: { post: true } } },
    });
    if (!report) {
      throw new NotFoundException(`Report with ID "${reportId}" not found.`);
    }

    const groupId = report.post?.groupId ?? report.comment?.post?.groupId;
    if (!groupId) {
      throw new BadRequestException(
        'This report is not tied to a group and cannot be resolved through this mutation.',
      );
    }
    await this.groupsService.assertCanModerateGroupPosts(groupId, actorId);

    await this.prisma.report.update({
      where: { id: reportId },
      data: { status },
    });

    return true;
  }
}
