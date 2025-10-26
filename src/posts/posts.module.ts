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

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Post.name, schema: PostSchema },
      { name: Like.name, schema: LikeSchema },
      { name: Comment.name, schema: CommentSchema },
    ]),
    // forwardRef est utilisé pour résoudre les dépendances circulaires
    // PostsModule a besoin de NotificationsModule, et NotificationsModule a besoin de PostsModule
    forwardRef(() => NotificationsModule),
    forwardRef(() => UsersModule), // Importer UsersModule pour avoir accès à UserLoader
  ],
  providers: [PostsService, CommentsService, LikesService, PostsResolver, CommentsResolver, LikesResolver, PostLoader, LikeLoader, CommentLoader],
  exports: [PostsService, PostLoader, LikeLoader, CommentLoader], // Exporter pour que d'autres modules puissent l'utiliser
})
export class PostsModule {}
