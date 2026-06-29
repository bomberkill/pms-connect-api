import { ObjectType, Field, ID } from '@nestjs/graphql';
import { User } from '../../users/models/users.model';
import { GroupMemberRole } from '../schemas/group.schema';

@ObjectType('GroupMembership')
export class GroupMembershipGQL {
  @Field(() => ID)
  _id: string;

  @Field(() => User)
  user: User;

  @Field(() => GroupMemberRole)
  role: GroupMemberRole;

  @Field()
  joinedAt: Date;
}
