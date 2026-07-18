import { Field, ID, InputType } from '@nestjs/graphql';
import { IsEnum, IsString } from 'class-validator';
import { GroupMemberRole } from '../schemas/group.schema';

@InputType()
export class UpdateGroupMemberRoleInput {
  @Field(() => ID)
  @IsString()
  userId: string;

  @Field(() => GroupMemberRole)
  @IsEnum(GroupMemberRole)
  role: GroupMemberRole;
}
