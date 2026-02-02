import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';
import { User } from './users.model';
import { ConnectionRequestStatus } from '../schemas/connection-request.schema';

// Register the enum for GraphQL to use. It's good practice to give it a unique name.
registerEnumType(ConnectionRequestStatus, {
  name: 'ConnectionRequestStatusGQL',
});

@ObjectType('ConnectionRequest')
export class ConnectionRequestGQL {
  @Field(() => ID)
  id: string;

  @Field(() => User)
  requester: User;

  @Field(() => User)
  recipient: User;

  @Field(() => ConnectionRequestStatus)
  status: ConnectionRequestStatus;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
