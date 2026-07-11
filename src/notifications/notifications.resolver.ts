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
import { CombinedAuthGuard } from '../auth/guards/combined-auth.guard';
import { AdminAuthGuard } from '../admin-auth/guards/admin-auth.guard';
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
import { User } from '../users/models/users.model';
import { GetAdminNotificationsArgs } from './dto/get-admin-notifications.args';

@Resolver(() => Notification)
export class NotificationsResolver {
  constructor(
    private readonly notificationsService: NotificationsService,
    @Inject(PUB_SUB) private readonly pubSub: PubSub,
  ) { }

  @UseGuards(CombinedAuthGuard)
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

  @UseGuards(CombinedAuthGuard)
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

  @UseGuards(CombinedAuthGuard)
  @Query(() => Number, { name: 'unreadNotificationsCount' })
  async unreadNotificationsCount(@CurrentUser() user: UserDocument): Promise<number> {
    return this.notificationsService.countUnread(user._id.toString());
  }

  @UseGuards(AdminAuthGuard)
  @Query(() => [Notification], { name: 'adminGetNotifications' })
  async adminGetNotifications(
    @Args() args: GetAdminNotificationsArgs,
  ): Promise<Notification[]> {
    const notifications = await this.notificationsService.adminFindAll(args);
    return notifications as unknown as Notification[];
  }

  @UseGuards(AdminAuthGuard)
  @Query(() => Number, { name: 'adminUnreadNotificationsCount' })
  async adminUnreadNotificationsCount(
    @Args('recipientId', { type: () => ID, nullable: true }) recipientId?: string,
  ): Promise<number> {
    return this.notificationsService.adminCountUnread(recipientId);
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
  // @UseGuards(BetterAuthGuard)
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

  @ResolveField('sender', () => User)
  sender(@Parent() notification: NotificationDocument): UserDocument {
    return notification.sender as UserDocument;
  }

  @ResolveField('recipient', () => User)
  recipient(@Parent() notification: NotificationDocument): UserDocument {
    return notification.recipient as UserDocument;
  }
}
