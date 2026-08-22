import { Inject, Injectable } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { PUB_SUB } from '../pubsub/pubsub.module';

// Single channel/payload-key name used for both publish and the
// subscription's async iterator (unlike followsUpdated's mismatched
// 'followsUpdated'/'FOLLOWS_UPDATED' pair elsewhere in this codebase).
export const PRESENCE_CHANGED = 'presenceChanged';

const TYPING_TIMEOUT_MS = 4000;

interface PresenceState {
  online: boolean;
  activeConversationId: string | null;
  typingConversationId: string | null;
  typingTimeout?: NodeJS.Timeout;
}

export interface PresenceChangedPayload {
  userId: string;
  online: boolean;
  typing: boolean;
  conversationId: string | null;
}

// In-memory, single-instance presence tracker — same limitation as
// PubSubModule (no Redis backing, doesn't propagate across server
// instances). Serves three related needs: online/offline (driven by the WS
// connection lifecycle), typing indicators (self-expiring, so an abrupt
// disconnect doesn't leave a stale "typing" state), and "actively viewing
// conversation X" (used by MessagesService to skip a redundant Notification
// when the recipient is already looking at the live thread).
@Injectable()
export class PresenceService {
  private readonly state = new Map<string, PresenceState>();

  constructor(@Inject(PUB_SUB) private readonly pubSub: PubSub) {}

  private getOrInit(userId: string): PresenceState {
    let entry = this.state.get(userId);
    if (!entry) {
      entry = { online: false, activeConversationId: null, typingConversationId: null };
      this.state.set(userId, entry);
    }
    return entry;
  }

  private publish(
    userId: string,
    overrides: { typing?: boolean; conversationId?: string | null } = {},
  ): void {
    const entry = this.getOrInit(userId);
    const payload: PresenceChangedPayload = {
      userId,
      online: entry.online,
      typing: overrides.typing ?? entry.typingConversationId !== null,
      conversationId:
        overrides.conversationId !== undefined ? overrides.conversationId : entry.typingConversationId,
    };
    this.pubSub.publish(PRESENCE_CHANGED, { [PRESENCE_CHANGED]: payload });
  }

  setOnline(userId: string): void {
    this.getOrInit(userId).online = true;
    this.publish(userId);
  }

  setOffline(userId: string): void {
    const entry = this.getOrInit(userId);
    entry.online = false;
    if (entry.typingTimeout) clearTimeout(entry.typingTimeout);
    entry.typingConversationId = null;
    this.publish(userId);
  }

  isOnline(userId: string): boolean {
    return this.state.get(userId)?.online ?? false;
  }

  setActiveConversation(userId: string, conversationId: string | null): void {
    this.getOrInit(userId).activeConversationId = conversationId;
  }

  getActiveConversation(userId: string): string | null {
    return this.state.get(userId)?.activeConversationId ?? null;
  }

  registerTyping(userId: string, conversationId: string): void {
    const entry = this.getOrInit(userId);
    if (entry.typingTimeout) clearTimeout(entry.typingTimeout);
    entry.typingConversationId = conversationId;
    entry.typingTimeout = setTimeout(() => {
      entry.typingConversationId = null;
      this.publish(userId, { typing: false, conversationId: null });
    }, TYPING_TIMEOUT_MS);
    this.publish(userId, { typing: true, conversationId });
  }
}
