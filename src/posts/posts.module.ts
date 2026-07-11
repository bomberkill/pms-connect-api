import { Module, forwardRef } from '@nestjs/common';
import { PostsService } from './posts.service';
import { PostsResolver } from './posts.resolver';
import { MongooseModule } from '@nestjs/mongoose';
import { Post, PostSchema } from './schemas/posts.schema';
import { Like, LikeSchema } from './schemas/likes.schema';
import { Comment, CommentSchema } from './schemas/comments.schema';
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

@Module({
  imports: [
    MongooseModule.forFeature([
      // On garde cette ligne pour l'enregistrer dans le scope du module courant
      { name: Post.name, schema: PostSchema },
      { name: Like.name, schema: LikeSchema },
      { name: Comment.name, schema: CommentSchema },
    ]),
    forwardRef(() => NotificationsModule),
    forwardRef(() => UsersModule),
    forwardRef(() => BookmarksModule),
    forwardRef(() => GroupsModule),
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
  // On exporte MongooseModule pour que les autres modules (comme UsersModule)
  // aient connaissance des modèles Post et Comment.
  exports: [
    PostsService,
    PostLoader,
    LikeLoader,
    CommentLoader,
    CommentsService,
    MongooseModule,
  ],
})
export class PostsModule {}
