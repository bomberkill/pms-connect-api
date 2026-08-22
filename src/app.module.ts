import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { AuthService } from './auth/auth.service';
import { BetterAuthTokenService } from './auth/better-auth-token.service';
import { FirebaseModule } from './firebase/firebase.module';
import { AdminsModule } from './admins/admins.module';
import { AdminAuthModule } from './admin-auth/admin-auth.module';
import { EmailModule } from './email/email.module';
import { PostsModule } from './posts/posts.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PubSubModule } from './pubsub/pubsub.module';
import { DataloaderModule } from './dataloader/dataloader.module';
import { ModuleRef, ContextIdFactory } from '@nestjs/core';
import { DataloaderService } from './dataloader/dataloader.service';
import { UserLoader } from './users/loaders/users.loader';
import { LikeLoader } from './posts/loaders/likes.loader';
import { PostLoader } from './posts/loaders/posts.loader';
import { CommentLoader } from './posts/loaders/comments.loader';
import { BookmarkLoader } from './bookmarks/loaders/bookmarks.loader';
import { BookmarksModule } from './bookmarks/bookmarks.module';
import { GroupsModule } from './groups/groups.module';
import { FollowsModule } from './follows/follows.module';
import { StorageModule } from './storage/storage.module';
import { ReportsModule } from './reports/reports.module';
import { CacheModule } from './cache/cache.module';
import { CacheInvalidationService } from './cache/cache-invalidation.service';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { GqlThrottlerGuard } from './common/guards/gql-throttler.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      imports: [DataloaderModule, AuthModule, BookmarksModule],
      inject: [ModuleRef, AuthService, BetterAuthTokenService],
      useFactory: (
        moduleRef: ModuleRef,
        authService: AuthService,
        betterAuthTokenService: BetterAuthTokenService,
      ) => ({
        autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
        installSubscriptionHandlers: true,
        subscriptions: {
          'graphql-ws': {
            onConnect: async (context) => {
              const { connectionParams, extra } = context; // extra contiendra les données persistantes pour cette connexion WS

              // Le client envoie { headers: { Authorization: 'Bearer <token>' } }
              // Nous devons donc extraire le token de cet objet.
              const authorizationHeader =
                (connectionParams?.headers as any)?.Authorization ||
                (connectionParams?.headers as any)?.authorization;

              if (
                authorizationHeader &&
                typeof authorizationHeader === 'string'
              ) {
                const token = authorizationHeader.replace('Bearer ', '');
                try {
                  // Valider le token (JWKS Better Auth) et récupérer l'utilisateur
                  const payload = await betterAuthTokenService.verify(token);
                  const user = await authService.validateAndLinkUser(payload);
                  // Attacher l'utilisateur au contexte de la connexion WebSocket
                  (extra as any).user = user;
                  return { user };
                } catch (e) {
                  console.error(
                    'Subscription authentication failed:',
                    e.message,
                  );
                  // Rejeter la connexion si le token est invalide
                  return false;
                }
              }

              // Rejeter la connexion si aucun token n'est fourni
              return false;
            },
          },
        },
        sortSchema: true,

        // Enable GraphQL Playground with enhanced documentation
        playground: {
          settings: {
            'request.credentials': 'include', // Enable cookies/auth
            'schema.polling.enable': false,
          },
          tabs: [
            {
              name: 'Welcome to PMS Connect API',
              endpoint: '/graphql',
              query: `# 🚀 Welcome to PMS Connect GraphQL API
#
# This is an interactive GraphQL playground where you can:
# - Explore the API schema (click "DOCS" on the right →)
# - Test queries and mutations
# - View real-time documentation
#
# 📚 Quick Start:
# 1. Click "DOCS" to see all available queries/mutations
# 2. Use Ctrl+Space for autocomplete
# 3. Add authentication header for protected routes:
#    HTTP HEADERS panel (bottom left):
#    {
#      "Authorization": "Bearer YOUR_TOKEN_HERE"
#    }
#
# 💡 Example Query:

query GetAllUsers {
  getAllUsers {
    id
    email
    slug
    firstName
    lastName
  }
}`,
            },
          ],
        },

        // Enable introspection for documentation
        introspection: true,

        graphiql: true,
        context: async (ctx) => {
          // For HTTP, ctx is { req, res }. For WS, ctx is { connection, extra }.
          if ('req' in ctx) {
            // HTTP request
            const req = ctx.req;
            const context: any = { req, user: (req as any).user };
            const contextId = ContextIdFactory.getByRequest(req);
            const dataloaderService = await moduleRef.resolve(
              DataloaderService,
              contextId,
              { strict: false },
            );
            const userLoader = await moduleRef.resolve(UserLoader, contextId, {
              strict: false,
            });
            const likeLoader = await moduleRef.resolve(LikeLoader, contextId, {
              strict: false,
            });
            const postLoader = await moduleRef.resolve(PostLoader, contextId, {
              strict: false,
            });
            const commentLoader = await moduleRef.resolve(
              CommentLoader,
              contextId,
              { strict: false },
            );
            const bookmarkLoader = await moduleRef.resolve(
              BookmarkLoader,
              contextId,
              { strict: false },
            );
            dataloaderService.setLoader(UserLoader, userLoader);
            dataloaderService.setLoader(LikeLoader, likeLoader);
            dataloaderService.setLoader(PostLoader, postLoader);
            dataloaderService.setLoader(CommentLoader, commentLoader);
            dataloaderService.setLoader(BookmarkLoader, bookmarkLoader);
            context.dataloaderService = dataloaderService;
            return context;
          } else {
            // WebSocket connection
            // Pour les souscriptions, le contexte est peuplé par onConnect.
            // 'extra' contient les données persistantes de la connexion WebSocket.
            // Nous retournons l'objet `extra` pour que `context.user` soit accessible.
            return ctx.extra;
          }
        },
      }),
    }),
    PrismaModule,
    UsersModule,
    AuthModule,
    FirebaseModule,
    AdminsModule,
    AdminAuthModule,
    EmailModule,
    PostsModule,
    NotificationsModule,
    DataloaderModule,
    PubSubModule,
    BookmarksModule,
    GroupsModule,
    FollowsModule,
    StorageModule,
    ReportsModule,

    // Cache Module (Redis with in-memory fallback)
    CacheModule,

    // Rate Limiting
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 60 seconds
        limit: 100, // 100 requests per minute
      },
    ]),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    AuthService,
    CacheInvalidationService,
    {
      provide: APP_GUARD,
      useClass: GqlThrottlerGuard,
    },
  ],
})
export class AppModule {}
