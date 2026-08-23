import { InputType, Field, ID } from '@nestjs/graphql';
import { IsString, IsNotEmpty, IsOptional, IsEnum, MaxLength } from 'class-validator';
import { ReportReason } from '../../../generated/prisma/enums';

@InputType()
export class CreateReportInput {
  @Field(() => ID, { nullable: true, description: 'Exactly one of postId/commentId/reportedUserId must be set.' })
  @IsOptional()
  @IsString()
  postId?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsString()
  commentId?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsString()
  reportedUserId?: string;

  @Field(() => ReportReason)
  @IsEnum(ReportReason)
  reason: ReportReason;

  @Field({ nullable: true, description: 'Free-text detail, mainly for reason: OTHER.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  details?: string;
}
