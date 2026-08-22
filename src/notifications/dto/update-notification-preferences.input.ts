import { InputType, Field, Int } from '@nestjs/graphql';
import { IsOptional, IsBoolean, IsInt, Min, Max } from 'class-validator';

@InputType()
export class UpdateNotificationPreferencesInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  notifyReplies?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  notifyMentions?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  notifyConnectionRequests?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  notifyReactions?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  notifyGroupActivity?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  notifyEstablishmentAnnouncements?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  quietHoursEnabled?: boolean;

  @Field(() => Int, { nullable: true, description: '0-23' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  quietHoursStart?: number;

  @Field(() => Int, { nullable: true, description: '0-23' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  quietHoursEnd?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  weeklyEmailDigest?: boolean;
}
