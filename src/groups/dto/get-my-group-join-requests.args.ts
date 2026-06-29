import { ArgsType, Field, ID } from '@nestjs/graphql';
import { IsMongoId, IsOptional } from 'class-validator';
import { PaginationArgs } from '../../posts/dto/pagination.args';
import { GroupJoinRequestStatus } from '../schemas/group-join-request.schema';

@ArgsType()
export class GetMyGroupJoinRequestsArgs extends PaginationArgs {
  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsMongoId()
  groupId?: string;

  @Field(() => GroupJoinRequestStatus, { nullable: true })
  @IsOptional()
  status?: GroupJoinRequestStatus;
}
