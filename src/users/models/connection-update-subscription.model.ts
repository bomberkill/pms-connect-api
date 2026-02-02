import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';
import { ConnectionRequestStatus } from '../schemas/connection-request.schema';

registerEnumType(ConnectionRequestStatus, {
  name: 'ConnectionRequestStatusGQL',
});

@ObjectType('ConnectionRequestForSubscriptionGQL')
export class ConnectionRequestForSubscriptionGQL {
  @Field(() => ID)
  id: string;

  @Field()
  requester: string;

  @Field()
  recipient: string;

  @Field(() => ConnectionRequestStatus)
  status: ConnectionRequestStatus;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
