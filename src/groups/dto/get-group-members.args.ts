import { ArgsType, Field, ID } from '@nestjs/graphql';
import { PaginationArgs } from '../../posts/dto/pagination.args';

@ArgsType()
export class GetGroupMembersArgs extends PaginationArgs {
  @Field(() => ID)
  groupId: string;
}
