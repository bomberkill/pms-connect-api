import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';
import { ReportReason, ReportStatus } from '../../../generated/prisma/enums';

registerEnumType(ReportReason, { name: 'ReportReason' });
registerEnumType(ReportStatus, { name: 'ReportStatus' });

// No `reporter`/`reporterId` field — reports are traced internally (rate
// limiting, future abuse detection) but never exposed to group moderators,
// per product decision. See the Report model comment in schema.prisma.
@ObjectType('Report')
export class ReportGQL {
  @Field(() => ID)
  id: string;

  @Field(() => ID, { nullable: true })
  postId: string | null;

  @Field(() => ID, { nullable: true })
  commentId: string | null;

  @Field(() => ID, { nullable: true })
  reportedUserId: string | null;

  @Field(() => ReportReason)
  reason: ReportReason;

  @Field({ nullable: true })
  details: string | null;

  @Field(() => ReportStatus)
  status: ReportStatus;

  @Field()
  createdAt: Date;
}
