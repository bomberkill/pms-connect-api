import { Injectable, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Messaging } from 'firebase-admin/messaging';
import { PubSub } from 'graphql-subscriptions';
import { PUB_SUB } from '../pubsub/pubsub.module';
import { FIREBASE_MESSAGING } from '../firebase/firebase.constants';
import { Notification, NotificationDocument } from './schemas/notification.schema';
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
  ) {}

  async create(dto: CreateNotificationDto): Promise<void> {
    const { recipients, sender, ...notificationData } = dto;

    // Filter out the sender to prevent self-notification
    const finalRecipients = recipients.filter(r => r !== sender);

    if (finalRecipients.length === 0) {
      return;
    }

    const notificationsToCreate = finalRecipients.map(recipientId => ({
      recipient: recipientId,
      sender,
      ...notificationData,
    }));

    const createdNotifications = await this.notificationModel.insertMany(notificationsToCreate);

    // Publish events and send push notifications for each created document
    for (const notification of createdNotifications) {
      this.pubSub.publish('NOTIFICATION_ADDED', { notificationAdded: notification });
      this.sendPushNotification(notification);
    }
  }

  async findForUser(userId: string, paginationArgs: PaginationArgs): Promise<NotificationDocument[]> {
    const { skip, limit } = paginationArgs;
    return this.notificationModel
      .find({ recipient: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('sender') // Eagerly load sender details
      .exec();
  }

  async markAsRead(notificationIds: string[], userId: string): Promise<boolean> {
    const result = await this.notificationModel.updateMany(
      { _id: { $in: notificationIds }, recipient: userId }, // Security check: user must be the recipient
      { $set: { read: true } },
    );
    return result.modifiedCount > 0;
  }

  // We accept a partial document here because the object from insertMany is not fully populated.
  // The `recipient` and `sender` will be string IDs.
  private async sendPushNotification(
    notification: Omit<Partial<Pick<NotificationDocument, 'recipient' | 'sender' | 'type' | 'entityId'>>, 'recipient' | 'sender'> & {
      recipient: string;
      sender: string;
      type: NotificationDocument['type']; // Ensure type is required
    },
  ): Promise<void> {
    try {
      const recipient = await this.userModel.findById(notification.recipient).select('fcmTokens').lean();
      if (!recipient || !recipient.fcmTokens || recipient.fcmTokens.length === 0) {
        console.log(`No FCM tokens found for user ${notification.recipient}`);
        return;
      }

      // We need the sender's details to build the message
      const sender = await this.userModel.findById(notification.sender).lean();
      if (!sender) return;

      const message = this.getNotificationMessage(notification, sender as UserDocument, recipient.language);

      const response = await this.firebaseMessaging.sendEachForMulticast({
        tokens: recipient.fcmTokens,
        notification: {
          title: 'New Notification on PMS-Connect',
          body: message,
        },
        // You can add more data here to help the client navigate
        data: {
          type: notification.type,
          entityId: notification.entityId?.toString() || '',
          senderId: notification.sender.toString(),
        },
      });

      console.log(`Successfully sent ${response.successCount} push notifications.`);
      if (response.failureCount > 0) {
        // Here you can add logic to clean up invalid/expired tokens from the user's document
        console.error(`Failed to send ${response.failureCount} push notifications.`);
      }
    } catch (error) {
      console.error('Error sending push notification:', error);
    }
  }

  // This logic is now self-contained within the service
  private getNotificationMessage(
    notification: Pick<NotificationDocument, 'type'>,
    sender: UserDocument, lang: string = 'en'
  ): string {
    let senderName = 'Someone';
    if (sender) {
      if (sender.get('userType') === 'INDIVIDUAL') {
        senderName = `${(sender as any).firstName} ${(sender as any).lastName}`;
      } else if (sender.get('userType') === 'LEGAL_ENTITY') {
        senderName = (sender as any).entityName;
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
      }
    };

    switch (notification.type) {
      case 'POST_LIKE': return messages[lang]?.POST_LIKE || messages.en.POST_LIKE;
      // Add other cases here...
      default: return messages[lang]?.default || messages.en.default;
    }
  }
}
