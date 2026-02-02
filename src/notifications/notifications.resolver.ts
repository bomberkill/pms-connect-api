import {
  Resolver,
  Query,
  Mutation,
  Args,
  Parent,
  ResolveField,
  ID,
  Subscription,
} from '@nestjs/graphql';
import { UseGuards, Inject } from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { NotificationsService } from './notifications.service';
import { Notification } from './models/notification.model';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserDocument } from '../users/schemas/users.schema';
import { PaginationArgs } from '../posts/dto/pagination.args';
import {
  NotificationDocument,
  NotificationType,
} from './schemas/notification.schema';
import { PubSub } from 'graphql-subscriptions';
import { PUB_SUB } from '../pubsub/pubsub.module';

@Resolver(() => Notification)
export class NotificationsResolver {
  constructor(
    private readonly notificationsService: NotificationsService,
    @Inject(PUB_SUB) private readonly pubSub: PubSub,
  ) {}

  @UseGuards(FirebaseAuthGuard)
  @Query(() => [Notification], { name: 'getMyNotifications' })
  async getMyNotifications(
    @CurrentUser() user: UserDocument,
    @Args() paginationArgs: PaginationArgs,
  ): Promise<Notification[]> {
    const notifications = await this.notificationsService.findForUser(
      user._id.toString(),
      paginationArgs,
    );
    return notifications as unknown as Notification[];
  }

  @UseGuards(FirebaseAuthGuard)
  @Mutation(() => Boolean, { name: 'markNotificationsAsRead' })
  async markNotificationsAsRead(
    @Args('notificationIds', { type: () => [ID] }) notificationIds: string[],
    @CurrentUser() user: UserDocument,
  ): Promise<boolean> {
    return this.notificationsService.markAsRead(
      notificationIds,
      user._id.toString(),
    );
  }

  // --- Subscription ---

  @Subscription(() => Notification, {
    name: 'notificationAdded',
    filter: (payload, variables, context) => {
      const currentUserId = context.user?._id.toString();
      // Only send the notification to the user it is intended for.
      return payload.notificationAdded.recipient.toString() === currentUserId;
    },
    resolve: (payload) => payload.notificationAdded,
  })
  // @UseGuards(FirebaseAuthGuard)
  notificationAdded() {
    return this.pubSub.asyncIterableIterator('NOTIFICATION_ADDED');
  }

  // --- Field Resolvers ---

  @ResolveField('message', () => String)
  message(@Parent() notification: NotificationDocument): string {
    const sender = notification.sender as UserDocument;
    let senderName = 'Someone';

    if (sender) {
      // Check the discriminator key to safely access properties
      if (sender.get('userType') === 'INDIVIDUAL') {
        senderName = `${(sender as any).firstName} ${(sender as any).lastName}`;
      } else if (sender.get('userType') === 'LEGAL_ENTITY') {
        senderName = (sender as any).entityName;
      }
    }

    switch (notification.type) {
      case NotificationType.POST_LIKE:
        return `${senderName} liked your post.`;
      case NotificationType.POST_COMMENT:
        return `${senderName} commented on your post.`;
      case NotificationType.NEW_FOLLOWER:
        return `${senderName} started following you.`;
      default:
        return 'You have a new notification.';
    }
  }
}
