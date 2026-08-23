import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType()
export class ConversationPresenceUpdate {
  @Field()
  online: boolean;

  @Field()
  typing: boolean;
}
