import { Module, forwardRef } from '@nestjs/common';
import { PostsService } from './posts.service';
import { PostsResolver } from './posts.resolver';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { PostLoader } from './loaders/posts.loader';
import { CommentsResolver } from './comments.resolver';
import { LikeLoader } from './loaders/likes.loader';
import { CommentsService } from './comments.service';
import { LikesService } from './likes.service';
import { LikesResolver } from './likes.resolver';
import { CommentLoader } from './loaders/comments.loader';
import { BookmarksModule } from 'src/bookmarks/bookmarks.module';
import { GroupsModule } from '../groups/groups.module';
import { FollowsModule } from '../follows/follows.module';

@Module({
  imports: [
    forwardRef(() => NotificationsModule),
    forwardRef(() => UsersModule),
    forwardRef(() => BookmarksModule),
    forwardRef(() => GroupsModule),
    FollowsModule,
  ],
  providers: [
    PostsService,
    CommentsService,
    LikesService,
    PostsResolver,
    CommentsResolver,
    LikesResolver,
    PostLoader,
    LikeLoader,
    CommentLoader,
  ],
  exports: [PostsService, PostLoader, LikeLoader, CommentLoader, CommentsService],
})
export class PostsModule {}
