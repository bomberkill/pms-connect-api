import { Injectable, Scope } from '@nestjs/common';
import * as DataLoader from 'dataloader';
import { CommentDocument } from '../schemas/comments.schema';
import { CommentsService } from '../comments.service';

@Injectable({ scope: Scope.REQUEST })
export class CommentLoader extends DataLoader<string, CommentDocument> {
  constructor(private readonly commentsService: CommentsService) {
    super(async (keys: readonly string[]) => {
      const comments = await this.commentsService.findManyByIds(
        keys as string[],
      );
      const commentsMap = new Map(
        comments.map((comment) => [comment.id, comment]),
      );
      return keys.map((key) => commentsMap.get(key) || null);
    });
  }
}
