import {
  Injectable,
  Inject,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { PrismaService } from '../prisma/prisma.service';
import { PUB_SUB } from '../pubsub/pubsub.module';
import { PresenceService } from '../presence/presence.service';
import { BlocksService } from '../blocks/blocks.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/schemas/notification.schema';
import { PaginationArgs } from '../posts/dto/pagination.args';

const WITH_SENDER = { sender: true } as const;

export const MESSAGE_ADDED = 'MESSAGE_ADDED';
export const MESSAGE_EDITED = 'MESSAGE_EDITED';
export const MESSAGE_DELETED = 'MESSAGE_DELETED';

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(PUB_SUB) private readonly pubSub: PubSub,
    private readonly presenceService: PresenceService,
    private readonly blocksService: BlocksService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private async assertNotBlocked(userAId: string, userBId: string): Promise<void> {
    const blockedIds = await this.blocksService.getMutualBlockIds(userAId);
    if (blockedIds.includes(userBId)) {
      throw new ForbiddenException('Cannot message a blocked user.');
    }
  }

  /**
   * Conversation is symmetric (unlike Follow/Block) — participant ids are
   * always stored with the lexicographically smaller id first so the
   * composite unique constraint prevents duplicates regardless of who
   * initiates.
   */
  private canonicalParticipantIds(userAId: string, userBId: string): [string, string] {
    return userAId < userBId ? [userAId, userBId] : [userBId, userAId];
  }

  async getOrCreateConversation(userAId: string, userBId: string) {
    if (userAId === userBId) {
      throw new ConflictException('Cannot start a conversation with yourself.');
    }

    const other = await this.prisma.user.findUnique({
      where: { id: userBId },
      select: { id: true },
    });
    if (!other) {
      throw new NotFoundException('User not found.');
    }

    await this.assertNotBlocked(userAId, userBId);

    const [participantAId, participantBId] = this.canonicalParticipantIds(userAId, userBId);

    return this.prisma.conversation.upsert({
      where: { participantAId_participantBId: { participantAId, participantBId } },
      create: { participantAId, participantBId },
      update: {},
      include: { participantA: true, participantB: true },
    });
  }

  async sendMessage(senderId: string, recipientId: string, content: string) {
    await this.assertNotBlocked(senderId, recipientId);

    const conversation = await this.getOrCreateConversation(senderId, recipientId);

    const message = await this.prisma.message.create({
      data: { conversationId: conversation.id, senderId, content },
      include: WITH_SENDER,
    });

    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: message.createdAt },
    });

    await this.pubSub.publish(MESSAGE_ADDED, {
      messageAdded: message,
      conversationId: conversation.id,
      participantAId: conversation.participantAId,
      participantBId: conversation.participantBId,
    });

    // Skip the standard notification if the recipient is already looking at
    // this conversation live (they'll see the message via the subscription
    // instantly — a notification would just be noise).
    if (this.presenceService.getActiveConversation(recipientId) !== conversation.id) {
      await this.notificationsService.create({
        recipients: [recipientId],
        sender: senderId,
        type: NotificationType.MESSAGE,
        entityId: senderId,
        onModel: 'User',
      });
    }

    return message;
  }

  async editMessage(messageId: string, userId: string, content: string) {
    const existing = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: { conversation: true },
    });
    if (!existing || existing.deleted) {
      throw new NotFoundException('Message not found.');
    }
    if (existing.senderId !== userId) {
      throw new ForbiddenException('You can only edit your own messages.');
    }

    const message = await this.prisma.message.update({
      where: { id: messageId },
      data: { content },
      include: WITH_SENDER,
    });

    await this.pubSub.publish(MESSAGE_EDITED, {
      messageEdited: message,
      conversationId: message.conversationId,
      participantAId: existing.conversation.participantAId,
      participantBId: existing.conversation.participantBId,
    });

    return message;
  }

  async deleteMessage(messageId: string, userId: string): Promise<boolean> {
    const existing = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: { conversation: true },
    });
    if (!existing || existing.deleted) {
      throw new NotFoundException('Message not found.');
    }
    if (existing.senderId !== userId) {
      throw new ForbiddenException('You can only delete your own messages.');
    }

    await this.prisma.message.update({
      where: { id: messageId },
      data: { deleted: true },
    });

    await this.pubSub.publish(MESSAGE_DELETED, {
      messageDeleted: messageId,
      conversationId: existing.conversationId,
      participantAId: existing.conversation.participantAId,
      participantBId: existing.conversation.participantBId,
    });

    return true;
  }

  private async assertParticipant(conversationId: string, userId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { participantA: true, participantB: true },
    });
    if (!conversation) {
      throw new NotFoundException('Conversation not found.');
    }
    if (conversation.participantAId !== userId && conversation.participantBId !== userId) {
      throw new ForbiddenException('You are not a participant in this conversation.');
    }
    return conversation;
  }

  async getConversationOrThrow(conversationId: string, userId: string) {
    return this.assertParticipant(conversationId, userId);
  }

  async getConversationsForUser(userId: string, paginationArgs: PaginationArgs) {
    const { skip, limit } = paginationArgs;
    const conversations = await this.prisma.conversation.findMany({
      where: { OR: [{ participantAId: userId }, { participantBId: userId }] },
      orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
      skip,
      take: limit,
      include: {
        participantA: true,
        participantB: true,
        messages: { orderBy: { createdAt: 'desc' }, take: 1, include: WITH_SENDER },
      },
    });

    if (conversations.length === 0) return conversations;

    const unreadCounts = await this.prisma.message.groupBy({
      by: ['conversationId'],
      where: {
        conversationId: { in: conversations.map((c) => c.id) },
        senderId: { not: userId },
        read: false,
        deleted: false,
      },
      _count: true,
    });
    const unreadByConversationId = new Map(unreadCounts.map((row) => [row.conversationId, row._count]));

    return conversations.map((conversation) => ({
      ...conversation,
      // Attached for Conversation.unreadCount's field resolver — not a
      // Prisma column, computed above in a single batched query.
      _unreadCount: unreadByConversationId.get(conversation.id) ?? 0,
    }));
  }

  async getMessages(conversationId: string, userId: string, paginationArgs: PaginationArgs) {
    await this.assertParticipant(conversationId, userId);
    const { skip, limit } = paginationArgs;
    return this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: WITH_SENDER,
    });
  }

  async markConversationRead(conversationId: string, userId: string): Promise<boolean> {
    await this.assertParticipant(conversationId, userId);
    await this.prisma.message.updateMany({
      where: { conversationId, senderId: { not: userId }, read: false },
      data: { read: true },
    });
    return true;
  }

  async getUnreadConversationsCount(userId: string): Promise<number> {
    const rows = await this.prisma.message.groupBy({
      by: ['conversationId'],
      where: {
        conversation: { OR: [{ participantAId: userId }, { participantBId: userId }] },
        senderId: { not: userId },
        read: false,
        deleted: false,
      },
      _count: true,
    });
    return rows.length;
  }
}
