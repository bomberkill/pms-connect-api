import { ArgsType, Field, ID } from '@nestjs/graphql';
import { IsOptional, IsEnum, IsMongoId } from 'class-validator';
import { PaginationArgs } from '../../posts/dto/pagination.args';
import { GroupJoinRequestStatus } from '../schemas/group-join-request.schema';

@ArgsType()
export class GetGroupJoinRequestsArgs extends PaginationArgs {
  @Field(() => ID, { nullable: true, description: 'Filter by a specific group ID' })
  @IsOptional()
  @IsMongoId()
  groupId?: string;

  @Field(() => GroupJoinRequestStatus, { nullable: true, description: 'Filter by status' })
  @IsOptional()
  @IsEnum(GroupJoinRequestStatus)
  status?: GroupJoinRequestStatus;
}