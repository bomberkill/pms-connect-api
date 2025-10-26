import { Injectable, Scope } from "@nestjs/common";
import * as DataLoader from "dataloader";
import { LikesService } from "../likes.service";

// La clé pour ce loader sera un objet contenant l'ID et le type de l'objet likable, ainsi que l'ID de l'utilisateur.
export interface LikeLoaderKey {
  likeableId: string;
  likeableType: 'Post' | 'Comment';
  userId: string;
}

@Injectable({scope: Scope.REQUEST})
export class LikeLoader extends DataLoader<LikeLoaderKey, boolean> {
  constructor(private readonly likesService: LikesService) {
    super(async (keys: readonly LikeLoaderKey[]) => {
      // 1. Extraire l'ID de l'utilisateur (supposé être le même pour tout le batch)
      const userId = keys[0]?.userId; // On suppose que l'utilisateur est le même pour toute la requête

      if (!userId || keys.length === 0) {
        return keys.map(() => false);
      }

      // 2. Utiliser une méthode de service pour trouver tous les likes en une seule requête
      const likedItemIds = await this.likesService.findUserLikesForItems(keys, userId);

      // 3. Mapper les résultats pour correspondre à l'ordre des clés d'entrée
      return keys.map(key => likedItemIds.has(key.likeableId));
    });
  }
}