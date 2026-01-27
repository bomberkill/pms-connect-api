import { ArgsType, Field } from '@nestjs/graphql';
import { IsOptional, IsString, IsEnum } from 'class-validator';
import { PaginationArgs } from '../../posts/dto/pagination.args';
import { GroupPrivacy } from '../schemas/group.schema';

@ArgsType()
export class GetGroupsArgs extends PaginationArgs {
  @Field({ nullable: true, description: 'Search by group name' })
  @IsOptional()
  @IsString()
  search?: string;

  @Field(() => GroupPrivacy, { nullable: true, description: 'Filter by privacy level' })
  @IsOptional()
  @IsEnum(GroupPrivacy)
  privacy?: GroupPrivacy;
}