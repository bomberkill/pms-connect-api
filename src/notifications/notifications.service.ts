import { Injectable, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Messaging } from 'firebase-admin/messaging';
import { PubSub } from 'graphql-subscriptions';
import { PUB_SUB } from '../pubsub/pubsub.module';
import { FIREBASE_MESSAGING } from '../firebase/firebase.constants';
import {
  Notification,
  NotificationDocument,
} from './schemas/notification.schema';
import { PaginationArgs } from '../posts/dto/pagination.args';
import { User, UserDocument } from '../users/schemas/users.schema';
import { CreateNotificationDto } from './dto/create-notification.dto';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private notificationModel: Model<NotificationDocument>,
    @Inject(PUB_SUB) private readonly pubSub: PubSub,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @Inject(FIREBASE_MESSAGING) private readonly firebaseMessaging: Messaging,
  ) { }

  async create(dto: CreateNotificationDto): Promise<void> {
    const { recipients, sender, ...notificationData } = dto;

    // Filter out the sender to prevent self-notification
    const finalRecipients = recipients.filter((r) => r !== sender);

    if (finalRecipients.length === 0) {
      return;
    }

    const notificationsToCreate = finalRecipients.map((recipientId) => ({
      recipient: recipientId,
      sender,
      ...notificationData,
    }));

    const createdNotifications = await this.notificationModel.insertMany(
      notificationsToCreate,
    );

    // Publish events and send push notifications for each created document
    for (const notification of createdNotifications) {
      this.pubSub.publish('NOTIFICATION_ADDED', {
        notificationAdded: notification,
      });
      this.sendPushNotification(notification);
    }
  }

  async findForUser(
    userId: string,
    paginationArgs: PaginationArgs,
  ): Promise<NotificationDocument[]> {
    const { skip, limit } = paginationArgs;
    return this.notificationModel
      .find({ recipient: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('sender') // Eagerly load sender details
      .exec();
  }

  async markAsRead(
    notificationIds: string[],
    userId: string,
  ): Promise<boolean> {
    const result = await this.notificationModel.updateMany(
      { _id: { $in: notificationIds }, recipient: userId }, // Security check: user must be the recipient
      { $set: { read: true } },
    );
    return result.modifiedCount > 0;
  }

  async countUnread(userId: string): Promise<number> {
    return this.notificationModel.countDocuments({ recipient: userId, read: false }).exec();
  }

  // We accept a partial document here because the object from insertMany is not fully populated.
  // The `recipient` and `sender` will be string IDs.
  private async sendPushNotification(
    notification: Omit<
      Partial<
        Pick<NotificationDocument, 'recipient' | 'sender' | 'type' | 'entityId'>
      >,
      'recipient' | 'sender'
    > & {
      recipient: string;
      sender: string;
      type: NotificationDocument['type']; // Ensure type is required
    },
  ): Promise<void> {
    try {
      const recipient = await this.userModel
        .findById(notification.recipient)
        .select('fcmTokens')
        .lean();
      if (
        !recipient ||
        !recipient.fcmTokens ||
        recipient.fcmTokens.length === 0
      ) {
        console.log(`No FCM tokens found for user ${notification.recipient}`);
        return;
      }

      // We need the sender's details to build the message
      const sender = await this.userModel.findById(notification.sender).lean();
      if (!sender) return;

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
          entityId: notification.entityId?.toString() || '',
          senderId: notification.sender.toString(),
          url: this.getNotificationUrl(notification),
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
          console.log(`Removing ${tokensToRemove.length} invalid tokens for user ${notification.recipient}`);
          await this.userModel.updateOne(
            { _id: notification.recipient },
            { $pull: { fcmTokens: { $in: tokensToRemove } } }
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
        default: 'You have a new notification.',
      },
      fr: {
        POST_LIKE: `${senderName} a aimé votre publication.`,
        COMMENT_LIKE: `${senderName} a aimé votre commentaire.`,
        POST_COMMENT: `${senderName} a commenté votre publication.`,
        NEW_FOLLOWER: `${senderName} a commencé à vous suivre.`,
        CONNECTION_REQUEST: `${senderName} vous a envoyé une demande de connexion.`,
        CONNECTION_ACCEPTED: `${senderName} a accepté votre demande de connexion.`,
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
      default:
        return messages[lang]?.default || messages.en.default;
    }
  }

  private getNotificationUrl(
    notification: Pick<NotificationDocument, 'type'> & { entityId?: any; sender?: any },
  ): string {
    switch (notification.type) {
      case 'POST_LIKE':
      case 'POST_COMMENT':
        return `/post/${notification.entityId}`;
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
