import { forwardRef, Module } from '@nestjs/common';
import { BookmarksService } from './bookmarks.service';
import { BookmarksResolver } from './bookmarks.resolver';
import { MongooseModule } from '@nestjs/mongoose';
import { Bookmark, BookmarkSchema } from './schemas/bookmark.schema';
import { UsersModule } from 'src/users/users.module';
import { PostsModule } from 'src/posts/posts.module';
import { DataloaderModule } from 'src/dataloader/dataloader.module';
import { BookmarkLoader } from 'src/bookmarks/loaders/bookmarks.loader';

@Module({
  imports: [
    MongooseModule.forFeature([
      {name: Bookmark.name, schema: BookmarkSchema}
    ]),
    forwardRef(() => UsersModule),
    forwardRef(() => PostsModule),
    DataloaderModule
  ],
  providers: [BookmarksService, BookmarksResolver,BookmarkLoader ],
  exports: [BookmarksService, BookmarkLoader],
})
export class BookmarksModule {}
