import { Injectable, Scope } from '@nestjs/common';
import * as DataLoader from 'dataloader';
import { BookmarksService } from '../bookmarks.service';

export interface BookmarkLoaderKey {
  userId: string;
  itemId: string; // Correction: Utiliser itemId pour la cohérence
}

@Injectable({ scope: Scope.REQUEST })
export class BookmarkLoader extends DataLoader<BookmarkLoaderKey, boolean> {
  constructor(private readonly bookmarksService: BookmarksService) {
    // Correction: Renommer la variable membre
    super(async (keys: readonly BookmarkLoaderKey[]) => {
      const userId = keys[0]?.userId;

      if (!userId || keys.length === 0) {
        return keys.map(() => false);
      }

      const bookmarkedItemIds =
        await this.bookmarksService.findUserBookmarkedItems(keys);

      // Correction: Mapper les clés d'origine aux résultats.
      // Pour chaque clé, vérifier si son `itemId` est dans le Set retourné par le service.
      return keys.map((key) => bookmarkedItemIds.has(key.itemId));
    });
  }
}
