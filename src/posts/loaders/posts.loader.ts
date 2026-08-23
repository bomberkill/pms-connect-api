import { Injectable, Scope } from '@nestjs/common';
import { PostsService } from '../posts.service';
import * as DataLoader from 'dataloader';
import { PostDocument } from '../schemas/posts.schema';

@Injectable({ scope: Scope.REQUEST })
export class PostLoader extends DataLoader<string, PostDocument> {
  constructor(private readonly postsService: PostsService) {
    super(async (keys: readonly string[]) => {
      const posts = await this.postsService.findManyByIds(keys as string[]);
      const postsMap = new Map(posts.map((post) => [post.id, post]));
      return keys.map((key) => postsMap.get(key) || null) as any;
    });
  }
}
