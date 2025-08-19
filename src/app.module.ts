import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { GraphQLModule } from '@nestjs/graphql'; // <--- NOUVEAU
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo'; // <--- NOUVEAU
import { join } from 'path'; // <--- NOUVEAU (utilitaire Node.js pour les chemins)
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { AuthService } from './auth/auth.service';
import { FirebaseModule } from './firebase/firebase.module'; // <--- NOUVEAU: Import du module Firebase
import { AdminsModule } from './admins/admins.module'; // <-- IMPORT ADMIN MODULE
import { AdminAuthModule } from './admin-auth/admin-auth.module';
import { EmailModule } from './email/email.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Rend ConfigService disponible globalement
      envFilePath: '.env', // Spécifiez le chemin de votre fichier .env
    }),
    GraphQLModule.forRoot<ApolloDriverConfig>({ // <--- AJOUTÉ
      driver: ApolloDriver, // <--- AJOUTÉ: Spécifie le driver Apollo
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'), // <--- AJOUTÉ: Génère le schéma GraphQL automatiquement
      sortSchema: true, // <--- AJOUTÉ (Optionnel): Trie le schéma par ordre alphabétique
      graphiql: true, // <--- AJOUTÉ (Optionnel mais recommandé pour le dev): Active GraphiQL
      // context: ({ req }) => ({ req }), // Décommentez si vous avez besoin d'accéder à l'objet request (ex: pour l'auth)
      // formatError: (error) => {
      //   // Log the full error for server-side debugging (optional)
      //   // console.error(JSON.stringify(error, null, 2));

      //   let message = error.message;
      //   const originalErrorMessage = (error.extensions?.originalError as { message?: string })?.message;
      //   const responseErrorMessage = (error.extensions?.response as { message?: string | string[] })?.message;

      //   if (originalErrorMessage) {
      //     message = originalErrorMessage;
      //   } else if (responseErrorMessage) {
      //     if (Array.isArray(responseErrorMessage)) {
      //       message = responseErrorMessage.join(', ');
      //     } else {
      //       message = responseErrorMessage;
      //     }
      //   }

      //   const graphQLFormattedError = {
      //     message: message, // Now guaranteed to be a string
      //     code: error.extensions?.code || 'INTERNAL_SERVER_ERROR',
      //   };
      //   // Handle cases where class-validator returns an array of messages
      //   // if (Array.isArray(graphQLFormattedError.message)) {
      //   //   graphQLFormattedError.message = graphQLFormattedError.message.join(', ');
      //   // }
      //   return graphQLFormattedError;
      // }
    }), // <--- AJOUTÉ
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI'),
        // autres options mongoose si besoin
      }),
      inject: [ConfigService],
    }),
    UsersModule,
    AuthModule,
    FirebaseModule,
    AdminsModule,
    AdminAuthModule,
    EmailModule

  ],
  controllers: [AppController],
  providers: [AppService, AuthService],
})
export class AppModule {}
