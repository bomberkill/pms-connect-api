import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { AuthService } from './auth/auth.service';
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      imports: [DataloaderModule, AuthModule, BookmarksModule],
      inject: [ModuleRef, AuthService],
      useFactory: (moduleRef: ModuleRef, authService: AuthService) => ({
        autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
        installSubscriptionHandlers: true,
        subscriptions: {
          'graphql-ws': {
            onConnect: async (context) => {
              const { connectionParams, extra } = context; // extra contiendra les données persistantes pour cette connexion WS

              // Le client envoie { headers: { Authorization: 'Bearer <token>' } }
              // Nous devons donc extraire le token de cet objet.
              const authorizationHeader = (connectionParams?.headers as any)?.Authorization || (connectionParams?.headers as any)?.authorization;

              if (authorizationHeader && typeof authorizationHeader === 'string') {
                const token = authorizationHeader.replace('Bearer ', '');
                try {
                  // Valider le token et récupérer l'utilisateur
                  const user = await authService.validateAndLinkUser(token);
                  // Attacher l'utilisateur au contexte de la connexion WebSocket
                  (extra as any).user = user;
                  return { user };
                } catch (e) {
                  console.error('Subscription authentication failed:', e.message);
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
        graphiql: true,
        context: async (ctx) => {
          // For HTTP, ctx is { req, res }. For WS, ctx is { connection, extra }.
          if ('req' in ctx) { // HTTP request
            const req = ctx.req;
            const context: any = { req, user: (req as any).user };
            const contextId = ContextIdFactory.getByRequest(req);
            const dataloaderService = await moduleRef.resolve(DataloaderService, contextId, { strict: false });
            const userLoader = await moduleRef.resolve(UserLoader, contextId, { strict: false });
            const likeLoader = await moduleRef.resolve(LikeLoader, contextId, { strict: false });
            const postLoader = await moduleRef.resolve(PostLoader, contextId, { strict: false });
            const commentLoader = await moduleRef.resolve(CommentLoader, contextId, { strict: false });
            const bookmarkLoader = await moduleRef.resolve(BookmarkLoader, contextId, { strict: false });
            dataloaderService.setLoader(UserLoader, userLoader);
            dataloaderService.setLoader(LikeLoader, likeLoader);
            dataloaderService.setLoader(PostLoader, postLoader);
            dataloaderService.setLoader(CommentLoader, commentLoader);
            dataloaderService.setLoader(BookmarkLoader, bookmarkLoader);
            context.dataloaderService = dataloaderService;
            return context;
          } else { // WebSocket connection
            // Pour les souscriptions, le contexte est peuplé par onConnect.
            // 'extra' contient les données persistantes de la connexion WebSocket.
            // Nous retournons l'objet `extra` pour que `context.user` soit accessible.
            return ctx.extra;
          }
        },
      }),
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI'),
        dbName: "pmsconnectdb"
      }),
      inject: [ConfigService],
    }),
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
  ],
  controllers: [AppController],
  providers: [AppService, AuthService],
})
export class AppModule {}
