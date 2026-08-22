import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { Messaging } from 'firebase-admin/messaging';
import { PubSub } from 'graphql-subscriptions';
import { PrismaService } from '../prisma/prisma.service';
import { PUB_SUB } from '../pubsub/pubsub.module';
import { FIREBASE_MESSAGING } from '../firebase/firebase.constants';
import type { NotificationDocument } from './schemas/notification.schema';
import type { Prisma } from '../../generated/prisma/client';
import { PaginationArgs } from '../posts/dto/pagination.args';
import { UserDocument } from '../users/schemas/users.schema';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { GetAdminNotificationsArgs } from './dto/get-admin-notifications.args';
import { UpdateNotificationPreferencesInput } from './dto/update-notification-preferences.input';
import { NotificationType } from './schemas/notification.schema';
// UsersService imports NotificationsService (to send a follow
// notification) — a genuine circular class dependency. Reflected
// constructor-param metadata can come back `undefined` for one side of a
// require cycle, so this uses an explicit forwardRef() token instead of
// relying on the (possibly-circularly-undefined) reflected type.
import { UsersService } from '../users/users.service';

// Maps the old polymorphic entityId+onModel pair onto the Prisma exclusive-
// arc FK columns (postId/commentId/groupId/targetUserId). Kept as a
// standalone helper since both create() and the push-notification/URL
// builders need to go the other way (FK -> logical entityId) too.
function entityFieldsFor(
  entityId: string | undefined,
  onModel: CreateNotificationDto['onModel'],
): Pick<
  Prisma.NotificationUncheckedCreateInput,
  'postId' | 'commentId' | 'groupId' | 'targetUserId'
> {
  if (!entityId || !onModel) return {};
  switch (onModel) {
    case 'Post':
      return { postId: entityId };
    case 'Comment':
      return { commentId: entityId };
    case 'Group':
      return { groupId: entityId };
    case 'User':
      return { targetUserId: entityId };
  }
}

const DEFAULT_PREFERENCES = {
  notifyReplies: true,
  notifyMentions: true,
  notifyConnectionRequests: true,
  notifyReactions: false,
  notifyGroupActivity: true,
  notifyEstablishmentAnnouncements: false,
  quietHoursEnabled: false,
  quietHoursStart: null as number | null,
  quietHoursEnd: null as number | null,
  weeklyEmailDigest: false,
};

// Which preference gates a given notification type. `null` means the type
// is always delivered regardless of preferences — used for types that
// aren't "engagement noise" the mockup's toggle list covers (the author
// needs to know their post was rejected even with reactions muted) or
// that have no corresponding toggle yet (establishment announcements have
// no notification type wired up anywhere in the codebase today).
function preferenceFieldFor(
  type: NotificationType,
): keyof typeof DEFAULT_PREFERENCES | null {
  switch (type) {
    case NotificationType.POST_COMMENT:
      return 'notifyReplies';
    case NotificationType.MENTION:
      return 'notifyMentions';
    case NotificationType.NEW_FOLLOWER:
    case NotificationType.CONNECTION_REQUEST:
    case NotificationType.CONNECTION_ACCEPTED:
      return 'notifyConnectionRequests';
    case NotificationType.POST_LIKE:
    case NotificationType.COMMENT_LIKE:
      return 'notifyReactions';
    case NotificationType.GROUP_JOIN_REQUEST:
    case NotificationType.GROUP_JOIN_REQUEST_ACCEPTED:
    case NotificationType.GROUP_INVITATION:
      return 'notifyGroupActivity';
    case NotificationType.POST_APPROVED:
    case NotificationType.POST_REJECTED:
      return null;
    default:
      return null;
  }
}

function isWithinQuietHours(
  pref: { quietHoursEnabled: boolean; quietHoursStart: number | null; quietHoursEnd: number | null },
): boolean {
  if (!pref.quietHoursEnabled || pref.quietHoursStart == null || pref.quietHoursEnd == null) {
    return false;
  }
  // Server-local hour — no per-user timezone field exists yet, see the
  // NotificationPreference model comment in schema.prisma.
  const hour = new Date().getHours();
  const { quietHoursStart: start, quietHoursEnd: end } = pref;
  return start <= end
    ? hour >= start && hour < end
    : hour >= start || hour < end; // wraps past midnight, e.g. 20 -> 7
}

function resolveEntityId(notification: NotificationDocument): string | null {
  return (
    notification.postId ??
    notification.commentId ??
    notification.groupId ??
    notification.targetUserId ??
    null
  );
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(PUB_SUB) private readonly pubSub: PubSub,
    // User now lives in Postgres — no more @InjectModel(User.name); Prisma
    // via UsersService instead of a Mongoose model on this connection.
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
    @Inject(FIREBASE_MESSAGING) private readonly firebaseMessaging: Messaging,
  ) { }

  async create(dto: CreateNotificationDto): Promise<void> {
    const { recipients, sender, type, entityId, onModel } = dto;

    // Filter out the sender to prevent self-notification
    let finalRecipients = recipients.filter((r) => r !== sender);

    if (finalRecipients.length === 0) {
      return;
    }

    // Gate on recipient preferences (missing row = defaults, see
    // getPreferences). Types with no preferenceFieldFor mapping are
    // always delivered.
    const preferenceField = preferenceFieldFor(type);
    let quietHoursRecipientIds = new Set<string>();
    if (preferenceField) {
      const rows = await this.prisma.notificationPreference.findMany({
        where: { userId: { in: finalRecipients } },
      });
      const byUserId = new Map(rows.map((r) => [r.userId, r]));
      finalRecipients = finalRecipients.filter((userId) => {
        const pref = byUserId.get(userId) ?? DEFAULT_PREFERENCES;
        return pref[preferenceField] !== false;
      });
      quietHoursRecipientIds = new Set(
        finalRecipients.filter((userId) =>
          isWithinQuietHours(byUserId.get(userId) ?? DEFAULT_PREFERENCES),
        ),
      );
    }

    if (finalRecipients.length === 0) {
      return;
    }

    const entityFields = entityFieldsFor(entityId, onModel);

    const createdNotifications = await this.prisma.notification.createManyAndReturn({
      data: finalRecipients.map((recipientId) => ({
        recipientId,
        senderId: sender,
        type,
        ...entityFields,
      })),
    });

    // Publish events and send push notifications for each created row —
    // quiet hours suppress the push only, the in-app notification still
    // gets created and shows up next time the recipient opens the app.
    for (const notification of createdNotifications) {
      this.pubSub.publish('NOTIFICATION_ADDED', {
        notificationAdded: notification,
      });
      if (!quietHoursRecipientIds.has(notification.recipientId)) {
        this.sendPushNotification(notification);
      }
    }
  }

  /**
   * Returns the caller's notification preferences, merged with defaults
   * for any field not yet customized (or if no row exists at all — no
   * backfill needed for pre-existing users).
   */
  async getPreferences(userId: string) {
    const pref = await this.prisma.notificationPreference.findUnique({
      where: { userId },
    });
    return { ...DEFAULT_PREFERENCES, ...pref };
  }

  async updatePreferences(
    userId: string,
    input: UpdateNotificationPreferencesInput,
  ) {
    const pref = await this.prisma.notificationPreference.upsert({
      where: { userId },
      create: { userId, ...input },
      update: { ...input },
    });
    return { ...DEFAULT_PREFERENCES, ...pref };
  }

  async findForUser(
    userId: string,
    paginationArgs: PaginationArgs,
  ): Promise<NotificationDocument[]> {
    const { skip, limit } = paginationArgs;
    return this.prisma.notification.findMany({
      where: { recipientId: userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    });
  }

  async markAsRead(
    notificationIds: string[],
    userId: string,
  ): Promise<boolean> {
    const result = await this.prisma.notification.updateMany({
      where: { id: { in: notificationIds }, recipientId: userId }, // Security check: user must be the recipient
      data: { read: true },
    });
    return result.count > 0;
  }

  async countUnread(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { recipientId: userId, read: false },
    });
  }

  async adminFindAll(
    args: GetAdminNotificationsArgs,
  ): Promise<NotificationDocument[]> {
    const { skip, limit, recipientId, senderId, type, read } = args;

    return this.prisma.notification.findMany({
      where: {
        ...(recipientId && { recipientId }),
        ...(senderId && { senderId }),
        ...(type && { type }),
        ...(typeof read === 'boolean' && { read }),
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    });
  }

  async adminCountUnread(recipientId?: string): Promise<number> {
    return this.prisma.notification.count({
      where: { read: false, ...(recipientId && { recipientId }) },
    });
  }

  private async sendPushNotification(
    notification: NotificationDocument,
  ): Promise<void> {
    try {
      const recipient = await this.usersService.findById(notification.recipientId);
      if (
        !recipient ||
        !recipient.fcmTokens ||
        recipient.fcmTokens.length === 0
      ) {
        console.log(`No FCM tokens found for user ${notification.recipientId}`);
        return;
      }

      // We need the sender's details to build the message
      const sender = await this.usersService.findById(notification.senderId);
      if (!sender) return;

      const entityId = resolveEntityId(notification);
      const message = this.getNotificationMessage(
        notification,
        sender as UserDocument,
        recipient.language,
      );

      const uniqueTokens = [...new Set(recipient.fcmTokens)];
      const messagePayload: any = {
        tokens: uniqueTokens,
        // We use Data-only messages to prevent the browser/OS from automatically showing a default notification.
        // This allows the Service Worker to handle the display (adding icons, click actions) exclusively.
        data: {
          title: 'PMS-Connect',
          body: message,
          type: notification.type,
          entityId: entityId || '',
          senderId: notification.senderId,
          url: this.getNotificationUrl(notification, entityId),
        },
        // Android specific config (High priority for data delivery)
        android: {
          priority: 'high',
        },
        // iOS specific config (Content available for background fetch)
        apns: {
          payload: {
            aps: {
              'content-available': 1,
            },
          },
        },
      };

      const response = await this.firebaseMessaging.sendEachForMulticast(messagePayload);

      console.log(
        `Successfully sent ${response.successCount} push notifications.`,
      );

      if (response.failureCount > 0) {
        const tokensToRemove: string[] = [];

        response.responses.forEach((resp, idx) => {
          if (!resp.success && resp.error) {
            const errorCode = resp.error.code;
            const failedToken = recipient.fcmTokens[idx];

            console.error(`Failed to send to token ${failedToken}: ${errorCode}`);

            if (
              errorCode === 'messaging/registration-token-not-registered' ||
              errorCode === 'messaging/invalid-registration-token'
            ) {
              tokensToRemove.push(failedToken);
            }
          }
        });

        if (tokensToRemove.length > 0) {
          console.log(`Removing ${tokensToRemove.length} invalid tokens for user ${notification.recipientId}`);
          await Promise.all(
            tokensToRemove.map((token) =>
              this.usersService.manageFcmToken(
                notification.recipientId,
                token,
                'remove',
              ),
            ),
          );
        }
      }
    } catch (error) {
      console.error('Error sending push notification:', error);
    }
  }

  // This logic is now self-contained within the service
  private getNotificationMessage(
    notification: Pick<NotificationDocument, 'type'>,
    sender: UserDocument,
    lang: string = 'en',
  ): string {
    let senderName = 'Someone';
    if (sender) {
      // sender is a POJO because of .lean(), so we access properties directly
      // casting to any to avoid TS issues if UserDocument definition is strict
      const s = sender as any;
      if (s.userType === 'INDIVIDUAL') {
        senderName = `${s.firstName} ${s.lastName}`;
      } else if (s.userType === 'LEGAL_ENTITY') {
        senderName = s.entityName;
      }
    }

    // In a real i18n setup, you would use a library like i18next
    // For example: i18n.t('notification.post_like', { lng: lang, senderName: senderName });
    const messages = {
      en: {
        POST_LIKE: `${senderName} liked your post.`,
        COMMENT_LIKE: `${senderName} liked your comment.`,
        POST_COMMENT: `${senderName} commented on your post.`,
        NEW_FOLLOWER: `${senderName} started following you.`,
        CONNECTION_REQUEST: `${senderName} sent you a connection request.`,
        CONNECTION_ACCEPTED: `${senderName} accepted your connection request.`,
        POST_APPROVED: 'Your post was approved and is now published.',
        POST_REJECTED: 'Your post was rejected by a group moderator.',
        default: 'You have a new notification.',
      },
      fr: {
        POST_LIKE: `${senderName} a aimé votre publication.`,
        COMMENT_LIKE: `${senderName} a aimé votre commentaire.`,
        POST_COMMENT: `${senderName} a commenté votre publication.`,
        NEW_FOLLOWER: `${senderName} a commencé à vous suivre.`,
        CONNECTION_REQUEST: `${senderName} vous a envoyé une demande de connexion.`,
        CONNECTION_ACCEPTED: `${senderName} a accepté votre demande de connexion.`,
        POST_APPROVED: 'Votre publication a été approuvée et est maintenant publiée.',
        POST_REJECTED: 'Votre publication a été rejetée par un modérateur du groupe.',
        default: 'Vous avez une nouvelle notification.',
      },
    };

    switch (notification.type) {
      case 'POST_LIKE':
        return messages[lang]?.POST_LIKE || messages.en.POST_LIKE;
      // Add other cases here...
      case 'COMMENT_LIKE':
        return messages[lang]?.COMMENT_LIKE || messages.en.COMMENT_LIKE;
      case 'POST_COMMENT':
        return messages[lang]?.POST_COMMENT || messages.en.POST_COMMENT;
      case 'NEW_FOLLOWER':
        return messages[lang]?.NEW_FOLLOWER || messages.en.NEW_FOLLOWER;
      case 'CONNECTION_REQUEST':
        return messages[lang]?.CONNECTION_REQUEST || messages.en.CONNECTION_REQUEST;
      case 'CONNECTION_ACCEPTED':
        return messages[lang]?.CONNECTION_ACCEPTED || messages.en.CONNECTION_ACCEPTED;
      case 'POST_APPROVED':
        return messages[lang]?.POST_APPROVED || messages.en.POST_APPROVED;
      case 'POST_REJECTED':
        return messages[lang]?.POST_REJECTED || messages.en.POST_REJECTED;
      default:
        return messages[lang]?.default || messages.en.default;
    }
  }

  private getNotificationUrl(
    notification: Pick<NotificationDocument, 'type'>,
    entityId: string | null,
  ): string {
    switch (notification.type) {
      case 'POST_LIKE':
      case 'POST_COMMENT':
      case 'POST_APPROVED':
      case 'POST_REJECTED':
        return `/post/${entityId}`;
      case 'NEW_FOLLOWER':
      case 'CONNECTION_REQUEST':
      case 'CONNECTION_ACCEPTED':
        // Ideally redirect to profile, but might need slug.
        // fallback to notifications page or use ID if frontend handles it
        return `/notifications`;
      default:
        return '/notifications';
    }
  }
}
