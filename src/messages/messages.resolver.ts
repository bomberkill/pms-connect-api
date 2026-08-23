import {
  Resolver,
  Query,
  Mutation,
  Subscription,
  Args,
  ID,
  Int,
  Context,
  Parent,
  ResolveField,
} from '@nestjs/graphql';
import { UseGuards, Inject } from '@nestjs/common';
import { PubSub, withFilter } from 'graphql-subscriptions';
import { PUB_SUB } from '../pubsub/pubsub.module';
import { BetterAuthGuard } from '../auth/guards/better-auth.guard';
import { GqlWsAuthGuard } from '../auth/guards/gql-ws-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserDocument } from '../users/schemas/users.schema';
import { User } from '../users/models/users.model';
import { PaginationArgs } from '../posts/dto/pagination.args';
import { MessagesService, MESSAGE_ADDED, MESSAGE_EDITED, MESSAGE_DELETED } from './messages.service';
import { PresenceService, PRESENCE_CHANGED, PresenceChangedPayload } from '../presence/presence.service';
import { Conversation } from './models/conversation.model';
import { Message } from './models/message.model';
import { ConversationPresenceUpdate } from './models/conversation-presence-update.model';

@Resolver(() => Conversation)
export class MessagesResolver {
  constructor(
    private readonly messagesService: MessagesService,
    private readonly presenceService: PresenceService,
    @Inject(PUB_SUB) private readonly pubSub: PubSub,
  ) {}

  // ---------- Queries ----------

  @UseGuards(BetterAuthGuard)
  @Query(() => [Conversation], { name: 'getMyConversations' })
  async getMyConversations(
    @CurrentUser() user: UserDocument,
    @Args() paginationArgs: PaginationArgs,
  ) {
    return this.messagesService.getConversationsForUser(user.id, paginationArgs);
  }

  @UseGuards(BetterAuthGuard)
  @Query(() => Conversation, { name: 'getConversationById' })
  async getConversationById(
    @CurrentUser() user: UserDocument,
    @Args('conversationId', { type: () => ID }) conversationId: string,
  ) {
    return this.messagesService.getConversationOrThrow(conversationId, user.id);
  }

  @UseGuards(BetterAuthGuard)
  @Query(() => [Message], { name: 'getMessages' })
  async getMessages(
    @CurrentUser() user: UserDocument,
    @Args('conversationId', { type: () => ID }) conversationId: string,
    @Args() paginationArgs: PaginationArgs,
  ) {
    return this.messagesService.getMessages(conversationId, user.id, paginationArgs);
  }

  @UseGuards(BetterAuthGuard)
  @Query(() => Int, { name: 'getUnreadConversationsCount' })
  async getUnreadConversationsCount(@CurrentUser() user: UserDocument): Promise<number> {
    return this.messagesService.getUnreadConversationsCount(user.id);
  }

  // ---------- Mutations ----------

  @UseGuards(BetterAuthGuard)
  @Mutation(() => Conversation, { name: 'getOrCreateConversationWithUser' })
  async getOrCreateConversationWithUser(
    @CurrentUser() user: UserDocument,
    @Args('userId', { type: () => ID }) userId: string,
  ) {
    return this.messagesService.getOrCreateConversation(user.id, userId);
  }

  @UseGuards(BetterAuthGuard)
  @Mutation(() => Message, { name: 'sendMessage' })
  async sendMessage(
    @CurrentUser() user: UserDocument,
    @Args('recipientId', { type: () => ID }) recipientId: string,
    @Args('content') content: string,
  ) {
    return this.messagesService.sendMessage(user.id, recipientId, content);
  }

  @UseGuards(BetterAuthGuard)
  @Mutation(() => Message, { name: 'editMessage' })
  async editMessage(
    @CurrentUser() user: UserDocument,
    @Args('messageId', { type: () => ID }) messageId: string,
    @Args('content') content: string,
  ) {
    return this.messagesService.editMessage(messageId, user.id, content);
  }

  @UseGuards(BetterAuthGuard)
  @Mutation(() => Boolean, { name: 'deleteMessage' })
  async deleteMessage(
    @CurrentUser() user: UserDocument,
    @Args('messageId', { type: () => ID }) messageId: string,
  ): Promise<boolean> {
    return this.messagesService.deleteMessage(messageId, user.id);
  }

  @UseGuards(BetterAuthGuard)
  @Mutation(() => Boolean, { name: 'markConversationRead' })
  async markConversationRead(
    @CurrentUser() user: UserDocument,
    @Args('conversationId', { type: () => ID }) conversationId: string,
  ): Promise<boolean> {
    return this.messagesService.markConversationRead(conversationId, user.id);
  }

  @UseGuards(BetterAuthGuard)
  @Mutation(() => Boolean, { name: 'setActiveConversation' })
  async setActiveConversation(
    @CurrentUser() user: UserDocument,
    @Args('conversationId', { type: () => ID }) conversationId: string,
  ): Promise<boolean> {
    await this.messagesService.getConversationOrThrow(conversationId, user.id);
    this.presenceService.setActiveConversation(user.id, conversationId);
    return true;
  }

  @UseGuards(BetterAuthGuard)
  @Mutation(() => Boolean, { name: 'clearActiveConversation' })
  async clearActiveConversation(@CurrentUser() user: UserDocument): Promise<boolean> {
    this.presenceService.setActiveConversation(user.id, null);
    return true;
  }

  @UseGuards(BetterAuthGuard)
  @Mutation(() => Boolean, { name: 'sendTypingIndicator' })
  async sendTypingIndicator(
    @CurrentUser() user: UserDocument,
    @Args('conversationId', { type: () => ID }) conversationId: string,
  ): Promise<boolean> {
    await this.messagesService.getConversationOrThrow(conversationId, user.id);
    this.presenceService.registerTyping(user.id, conversationId);
    return true;
  }

  // ---------- Subscriptions ----------

  @UseGuards(GqlWsAuthGuard)
  @Subscription(() => Message, {
    name: 'messageAdded',
    filter: (
      payload: { messageAdded: unknown; conversationId: string; participantAId: string; participantBId: string },
      variables: { conversationId: string },
      context: { user?: { id: string } },
    ) => {
      const userId = context.user?.id;
      if (!userId || payload.conversationId !== variables.conversationId) return false;
      return payload.participantAId === userId || payload.participantBId === userId;
    },
    resolve: (payload: { messageAdded: unknown }) => payload.messageAdded,
  })
  messageAdded(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    @Args('conversationId', { type: () => ID }) _conversationId: string,
  ) {
    return this.pubSub.asyncIterableIterator(MESSAGE_ADDED);
  }

  @UseGuards(GqlWsAuthGuard)
  @Subscription(() => Message, {
    name: 'messageEdited',
    filter: (
      payload: { messageEdited: unknown; conversationId: string; participantAId: string; participantBId: string },
      variables: { conversationId: string },
      context: { user?: { id: string } },
    ) => {
      const userId = context.user?.id;
      if (!userId || payload.conversationId !== variables.conversationId) return false;
      return payload.participantAId === userId || payload.participantBId === userId;
    },
    resolve: (payload: { messageEdited: unknown }) => payload.messageEdited,
  })
  messageEdited(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    @Args('conversationId', { type: () => ID }) _conversationId: string,
  ) {
    return this.pubSub.asyncIterableIterator(MESSAGE_EDITED);
  }

  @UseGuards(GqlWsAuthGuard)
  @Subscription(() => ID, {
    name: 'messageDeleted',
    filter: (
      payload: { messageDeleted: string; conversationId: string; participantAId: string; participantBId: string },
      variables: { conversationId: string },
      context: { user?: { id: string } },
    ) => {
      const userId = context.user?.id;
      if (!userId || payload.conversationId !== variables.conversationId) return false;
      return payload.participantAId === userId || payload.participantBId === userId;
    },
    resolve: (payload: { messageDeleted: string }) => payload.messageDeleted,
  })
  messageDeleted(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    @Args('conversationId', { type: () => ID }) _conversationId: string,
  ) {
    return this.pubSub.asyncIterableIterator(MESSAGE_DELETED);
  }

  // Unlike the filters above (stateless, depend only on `variables`+
  // `payload`), this one needs to know the OTHER participant's id, which
  // requires a one-time DB lookup — done here in the resolver method body
  // (runs once per subscribe call) rather than per-event, via withFilter's
  // per-subscription closure. This is the only subscription in the codebase
  // using withFilter for that reason; every other one only needs a
  // declarative filter since its payload+variables are self-sufficient.
  @UseGuards(GqlWsAuthGuard)
  @Subscription(() => ConversationPresenceUpdate, {
    name: 'conversationPresence',
    resolve: (
      payload: { presenceChanged: PresenceChangedPayload },
      variables: { conversationId: string },
    ) => ({
      online: payload.presenceChanged.online,
      typing:
        payload.presenceChanged.typing && payload.presenceChanged.conversationId === variables.conversationId,
    }),
  })
  async conversationPresence(
    @Args('conversationId', { type: () => ID }) conversationId: string,
    @Context() context: { user: { id: string } },
  ) {
    const conversation = await this.messagesService.getConversationOrThrow(
      conversationId,
      context.user.id,
    );
    const otherParticipantId =
      conversation.participantAId === context.user.id
        ? conversation.participantBId
        : conversation.participantAId;

    return withFilter(
      () => this.pubSub.asyncIterableIterator(PRESENCE_CHANGED),
      (payload: { presenceChanged: PresenceChangedPayload }) =>
        payload.presenceChanged.userId === otherParticipantId,
    )();
  }

  // ---------- Field resolvers ----------

  // @CurrentUser() (not @Context()) — the HTTP context's own top-level
  // `context.user` is snapshotted from `req.user` at context-creation time,
  // which runs BEFORE BetterAuthGuard's passport strategy populates
  // `req.user` — it's always undefined there. @CurrentUser() instead reads
  // `context.req.user` live off the shared `req` object, which the guard
  // has already populated by the time a resolver runs. Confirmed as a real
  // bug via live testing (otherParticipant always resolved to the viewer
  // themselves) before switching to this.
  @ResolveField('otherParticipant', () => User)
  resolveOtherParticipant(
    @Parent() conversation: any, // eslint-disable-line @typescript-eslint/no-explicit-any
    @CurrentUser() viewer: UserDocument,
  ) {
    return conversation.participantAId === viewer.id ? conversation.participantB : conversation.participantA;
  }

  @ResolveField('lastMessage', () => Message, { nullable: true })
  resolveLastMessage(@Parent() conversation: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
    return conversation.messages?.[0] ?? null;
  }

  @ResolveField('unreadCount', () => Int)
  resolveUnreadCount(@Parent() conversation: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
    return conversation._unreadCount ?? 0;
  }
}
