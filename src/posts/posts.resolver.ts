import { Resolver, Query, Mutation, Args, ID, Parent, ResolveField } from '@nestjs/graphql';
import { UseGuards, forwardRef, Inject } from '@nestjs/common';
import { PostsService } from './posts.service';
import { Post } from './models/posts.model';
import { CreatePostInput } from './dto/create-post.input';
import { UpdatePostInput } from './dto/update-post.input';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { PaginationArgs } from './dto/pagination.args';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserDocument } from '../users/schemas/users.schema';
import { PostDocument } from './schemas/posts.schema';
import { Dataloader } from 'src/dataloader/dataloader.decorator';
import { UserLoader } from 'src/users/loaders/users.loader';
import { LikeLoader } from '../posts/loaders/likes.loader';
import { User } from 'src/users/models/users.model';
import { Date } from 'mongoose';

@Resolver(() => Post)
export class PostsResolver {
  constructor(private readonly postsService: PostsService) {}

  @UseGuards(FirebaseAuthGuard)
  @Mutation(() => Post, { name: 'createPost' })
  async createPost(
    @Args('createPostInput') createPostInput: CreatePostInput,
    @CurrentUser() user: UserDocument,
  ): Promise<PostDocument> {
    return this.postsService.create(createPostInput, user._id.toString());
    // return postDocument as unknown as Post;
  }

  @UseGuards(FirebaseAuthGuard) // Protéger la lecture pour s'assurer que l'utilisateur est connecté
  @Query(() => Post, { name: 'getPostById', nullable: true })
  async getPostById(@Args('id', { type: () => ID }) id: string): Promise<PostDocument> {
    return this.postsService.findOne(id);
    // return postDocument as unknown as Post;
  }

  @UseGuards(FirebaseAuthGuard)
  @Mutation(() => Boolean, { name: 'removePost' })
  async removePost(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: UserDocument,
  ): Promise<boolean> {
    return this.postsService.remove(id, user._id.toString());
  }

  @UseGuards(FirebaseAuthGuard)
  @Query(() => [Post], { name: 'getFeed' })
  async getFeed(
    @CurrentUser() user: UserDocument,
    @Args() paginationArgs: PaginationArgs,
  ): Promise<PostDocument[]> {
    let authorIds: string[];

    // Si l'utilisateur ne suit personne, on lui montre un fil de découverte.
    if (user.following.length === 0) {
      // APPROCHE ACTUELLE (pour une nouvelle application) :
      // On affiche tous les posts récents de la plateforme pour favoriser la découverte.
      return this.postsService.findAllPosts(paginationArgs);
      // return allPosts as unknown as Post[];

      /*
      // APPROCHE FUTURE (quand l'application aura du trafic) :
      // 1. Trouver les auteurs les plus populaires.
      const popularAuthorIds = await this.postsService.findPopularAuthors();
      // 2. Récupérer les posts récents de ces auteurs.
      const posts = await this.postsService.findPostsByAuthors(popularAuthorIds, paginationArgs);
      return posts as unknown as Post[];
      */
    } else {
      // Sinon, on construit le fil d'actualité standard avec les posts des personnes suivies et ses propres posts.
      authorIds = [...user.following.map(id => id.toString()), user._id.toString()];
      return this.postsService.findPostsByAuthors(authorIds, paginationArgs);
      // return posts as unknown as Post[];
    }
  }

  @UseGuards(FirebaseAuthGuard)
  @Query(() => Number, { name: 'getNewFeedItemsCount' })
  async getNewFeedItemsCount(
    @CurrentUser() user: UserDocument,
    @Args('since', { type: () => Date, description: 'The ID of the most recent post the user has seen.' }) since: Date,
  ): Promise<number> {
    return this.postsService.countNewPosts(since);
    // if (user.following.length === 0) {
    // } else {
    //   const authorIds = [...user.following.map(id => id.toString()), user._id.toString()];
    //   return this.postsService.countNewPostsByAuthors(authorIds, since);
    // }
  }

  // TODO: Ajouter les resolvers pour les champs `author`
  @UseGuards(FirebaseAuthGuard)
  @Mutation(() => Post, { name: 'updatePost' })
  async updatePost(
    @Args('postId', { type: () => ID }) postId: string,
    @Args('updatePostInput') updatePostInput: UpdatePostInput,
    @CurrentUser() user: UserDocument,
  ): Promise<PostDocument> {
    return this.postsService.update(postId, user._id.toString(), updatePostInput);
    // return updatedPost as unknown as Post;
  }

  // --- Field Resolvers ---

  @ResolveField('author', () => User)
  async getAuthor(
    @Parent() post: PostDocument,
    @Dataloader(UserLoader) userLoader: UserLoader,
  ): Promise<UserDocument> {
    // post.author peut être un ID ou un objet User populé.
    // On s'assure de passer un ID au loader.
    const authorId = typeof post.author === 'string' ? post.author : (post.author as any)._id.toString();
    return userLoader.load(authorId);
  }

  @ResolveField('isLiked', () => Boolean, { nullable: true })
  async isLiked(
    @Parent() post: PostDocument,
    @CurrentUser() user: UserDocument | null,
    @Dataloader(LikeLoader) likeLoader: LikeLoader,
  ): Promise<boolean | null> {
    if (!user) {
      return null;
    }
    // Le DataLoader va regrouper tous les post.id et vérifier en une seule fois.
    return likeLoader.load({ likeableId: post._id.toString(), likeableType: 'Post', userId: user._id.toString() });
  }
}