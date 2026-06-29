import { Field, ID, InputType } from '@nestjs/graphql';
import { IsEnum, IsMongoId } from 'class-validator';
import { GroupMemberRole } from '../schemas/group.schema';

@InputType()
export class UpdateGroupMemberRoleInput {
  @Field(() => ID)
  @IsMongoId()
  userId: string;

  @Field(() => GroupMemberRole)
  @IsEnum(GroupMemberRole)
  role: GroupMemberRole;
}
