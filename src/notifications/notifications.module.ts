import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationsService } from './notifications.service';
import { NotificationsResolver } from './notifications.resolver';
import {
  Notification,
  NotificationSchema,
} from './schemas/notification.schema';
import { PostsModule } from '../posts/posts.module';
import { UsersModule } from 'src/users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
    ]),
    forwardRef(() => PostsModule), // Utiliser forwardRef pour la dépendance circulaire
    forwardRef(() => UsersModule), // Utiliser forwardRef pour la dépendance circulaire
  ],
  providers: [NotificationsResolver, NotificationsService],
  exports: [NotificationsService], // Export the service so other modules can use it
})
export class NotificationsModule {}
