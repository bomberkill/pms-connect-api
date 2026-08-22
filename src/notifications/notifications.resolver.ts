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
import { UpdateNotificationPreferencesInput } from './dto/update-notification-preferences.input';
import { NotificationPreferenceGQL } from './models/notification-preference.model';
import { Dataloader } from '../dataloader/dataloader.decorator';
import { UserLoader } from '../users/loaders/users.loader';

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
      user.id,
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
      user.id,
    );
  }

  @UseGuards(CombinedAuthGuard)
  @Query(() => Number, { name: 'unreadNotificationsCount' })
  async unreadNotificationsCount(@CurrentUser() user: UserDocument): Promise<number> {
    return this.notificationsService.countUnread(user.id);
  }

  @UseGuards(CombinedAuthGuard)
  @Query(() => NotificationPreferenceGQL, { name: 'getMyNotificationPreferences' })
  async getMyNotificationPreferences(
    @CurrentUser() user: UserDocument,
  ): Promise<NotificationPreferenceGQL> {
    return this.notificationsService.getPreferences(user.id);
  }

  @UseGuards(CombinedAuthGuard)
  @Mutation(() => NotificationPreferenceGQL, { name: 'updateNotificationPreferences' })
  async updateNotificationPreferences(
    @Args('input') input: UpdateNotificationPreferencesInput,
    @CurrentUser() user: UserDocument,
  ): Promise<NotificationPreferenceGQL> {
    return this.notificationsService.updatePreferences(user.id, input);
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
      const currentUserId = context.user?.id;
      // Only send the notification to the user it is intended for.
      return payload.notificationAdded.recipientId === currentUserId;
    },
    resolve: (payload) => payload.notificationAdded,
  })
  // No @UseGuards here: WS connections are already authenticated in
  // onConnect (app.module.ts) before any subscription is allowed, and the
  // filter above scopes delivery to the connected user's own notifications.
  notificationAdded() {
    return this.pubSub.asyncIterableIterator('NOTIFICATION_ADDED');
  }

  // --- Field Resolvers ---

  @ResolveField('message', () => String)
  async message(
    @Parent() notification: NotificationDocument,
    @Dataloader(UserLoader) userLoader: UserLoader,
  ): Promise<string> {
    const sender = await userLoader.load(notification.senderId);
    let senderName = 'Someone';

    if (sender) {
      if (sender.userType === 'INDIVIDUAL') {
        senderName = `${sender.firstName} ${sender.lastName}`;
      } else if (sender.userType === 'LEGAL_ENTITY') {
        senderName = sender.entityName;
      }
    }

    switch (notification.type) {
      case NotificationType.POST_LIKE:
        return `${senderName} liked your post.`;
      case NotificationType.POST_COMMENT:
        return `${senderName} commented on your post.`;
      case NotificationType.NEW_FOLLOWER:
        return `${senderName} started following you.`;
      case NotificationType.POST_APPROVED:
        return 'Your post was approved and is now published.';
      case NotificationType.POST_REJECTED:
        return 'Your post was rejected by a group moderator.';
      default:
        return 'You have a new notification.';
    }
  }

  @ResolveField('sender', () => User)
  async sender(
    @Parent() notification: NotificationDocument,
    @Dataloader(UserLoader) userLoader: UserLoader,
  ): Promise<UserDocument> {
    return userLoader.load(notification.senderId);
  }

  @ResolveField('recipient', () => User)
  async recipient(
    @Parent() notification: NotificationDocument,
    @Dataloader(UserLoader) userLoader: UserLoader,
  ): Promise<UserDocument> {
    return userLoader.load(notification.recipientId);
  }

  // The old Mongoose schema had a single loose entityId+onModel pair;
  // Prisma models it as an exclusive arc (postId/commentId/groupId/
  // targetUserId). This resolver derives the old single-entityId shape the
  // GraphQL API already commits to, so no frontend/admin-panel change needed.
  @ResolveField('entityId', () => ID, { nullable: true })
  resolveEntityId(@Parent() notification: NotificationDocument): string | null {
    return (
      notification.postId ??
      notification.commentId ??
      notification.groupId ??
      notification.targetUserId ??
      null
    );
  }
}
