import { Module, forwardRef } from '@nestjs/common';
import { UsersResolver } from './users.resolver';
import { UsersService } from './users.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { UserLoader } from './loaders/users.loader';
import { ConnectionRequestsService } from './connection-requests.service';
import { ConnectionRequestsResolver } from './connection-requests.resolver';
import { PubSubModule } from '../pubsub/pubsub.module';
import { PostsModule } from 'src/posts/posts.module';
import { FollowsModule } from '../follows/follows.module';
import { BlocksModule } from '../blocks/blocks.module';

@Module({
  imports: [
    forwardRef(() => NotificationsModule),
    forwardRef(() => PostsModule), // Importer PostsModule pour rendre les modèles Post et Comment disponibles
    PubSubModule,
    FollowsModule,
    BlocksModule,
  ],
  providers: [
    UsersResolver,
    UsersService,
    UserLoader,
    ConnectionRequestsService,
    ConnectionRequestsResolver,
  ],
  exports: [UsersService, UserLoader],
})
export class UsersModule {}
