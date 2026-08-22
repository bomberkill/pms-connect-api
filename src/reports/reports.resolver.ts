import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportGQL } from './models/report.model';
import { CreateReportInput } from './dto/create-report.input';
import { CombinedAuthGuard } from '../auth/guards/combined-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserDocument } from '../users/schemas/users.schema';
import { ReportStatus } from '../../generated/prisma/enums';

@Resolver(() => ReportGQL)
export class ReportsResolver {
  constructor(private readonly reportsService: ReportsService) {}

  @UseGuards(CombinedAuthGuard)
  @Mutation(() => Boolean, { name: 'createReport' })
  async createReport(
    @Args('input') input: CreateReportInput,
    @CurrentUser() user: UserDocument,
  ): Promise<boolean> {
    return this.reportsService.create(input, user.id);
  }

  @UseGuards(CombinedAuthGuard)
  @Query(() => [ReportGQL], { name: 'getReports' })
  async getReports(
    @Args('groupId', { type: () => ID }) groupId: string,
    @Args('status', { type: () => ReportStatus, nullable: true }) status: ReportStatus | undefined,
    @CurrentUser() user: UserDocument,
  ) {
    return this.reportsService.findForGroup(groupId, user.id, status);
  }

  @UseGuards(CombinedAuthGuard)
  @Mutation(() => Boolean, { name: 'resolveReport' })
  async resolveReport(
    @Args('reportId', { type: () => ID }) reportId: string,
    @Args('status', { type: () => ReportStatus }) status: ReportStatus,
    @CurrentUser() user: UserDocument,
  ): Promise<boolean> {
    return this.reportsService.resolve(reportId, user.id, status);
  }
}
