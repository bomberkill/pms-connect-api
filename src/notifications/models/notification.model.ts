import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';
import { User } from '../../users/models/users.model';
import { NotificationType } from '../schemas/notification.schema';

// Register the enum with GraphQL
registerEnumType(NotificationType, {
  name: 'NotificationType',
});

@ObjectType()
export class Notification {
  @Field(() => ID)
  id: string;

  @Field(() => User)
  sender: User; // This will be resolved

  @Field(() => User)
  recipient: User;

  @Field(() => NotificationType)
  type: NotificationType;

  @Field(() => Boolean)
  read: boolean;

  @Field()
  createdAt: Date;

  // A dynamically generated message for the frontend
  @Field()
  message: string;

  // The ID of the entity to navigate to (e.g., post ID)
  @Field(() => ID, { nullable: true })
  entityId?: string;
}
