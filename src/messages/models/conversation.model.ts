import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import { User } from 'src/users/models/users.model';
import { Message } from './message.model';

@ObjectType()
export class Conversation {
  @Field(() => ID)
  id: string;

  // Resolved (not a raw Prisma column) — MessagesResolver picks
  // participantA/participantB based on which one isn't the current viewer.
  @Field(() => User)
  otherParticipant: User;

  @Field(() => Message, { nullable: true })
  lastMessage?: Message | null;

  @Field(() => Int)
  unreadCount: number;

  @Field({ nullable: true })
  lastMessageAt?: Date | null;

  @Field()
  createdAt: Date;
}
