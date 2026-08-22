import { ObjectType, Field, ID } from '@nestjs/graphql';
import { User } from 'src/users/models/users.model';

@ObjectType()
export class Message {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  conversationId: string;

  // Deliberately NOT a @ResolveField()+DataLoader field (unlike Post.author/
  // Comment.author elsewhere) — this type is pushed live over the
  // messageAdded/messageEdited subscriptions, and the WS GraphQL context has
  // no dataloaderService (only HTTP requests get one wired in
  // app.module.ts's context factory). MessagesService always eagerly
  // `include: { sender: true }`s in every query that returns a Message, so
  // this resolves as a plain property directly off the already-populated
  // Prisma row — safe for both HTTP queries and WS-pushed subscription
  // payloads.
  @Field(() => User)
  sender: User;

  @Field()
  content: string;

  @Field()
  read: boolean;

  @Field()
  deleted: boolean;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
