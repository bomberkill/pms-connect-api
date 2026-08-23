import { Module, forwardRef } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsResolver } from './notifications.resolver';
import { PostsModule } from '../posts/posts.module';
import { UsersModule } from 'src/users/users.module';

@Module({
  imports: [
    forwardRef(() => PostsModule), // Utiliser forwardRef pour la dépendance circulaire
    forwardRef(() => UsersModule), // Utiliser forwardRef pour la dépendance circulaire
  ],
  providers: [NotificationsResolver, NotificationsService],
  exports: [NotificationsService], // Export the service so other modules can use it
})
export class NotificationsModule {}
