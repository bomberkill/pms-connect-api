import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';
import { User } from '../../users/models/users.model';
import { GroupGQL } from './group.model';
import { GroupJoinRequestStatus } from '../schemas/group-join-request.schema';

// Register the enum for GraphQL to use. It's good practice to give it a unique name.
registerEnumType(GroupJoinRequestStatus, {
  name: 'GroupJoinRequestStatusGQL',
});

@ObjectType('GroupJoinRequest')
export class GroupJoinRequestGQL {
  @Field(() => ID)
  id: string;

  @Field(() => GroupGQL)
  group: GroupGQL;

  @Field(() => User)
  user: User;

  @Field(() => GroupJoinRequestStatus)
  status: GroupJoinRequestStatus;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
