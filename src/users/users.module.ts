import { Module, forwardRef } from '@nestjs/common';
import { UsersResolver } from './users.resolver';
import { UsersService } from './users.service';
import { MongooseModule } from '@nestjs/mongoose';
import { ConnectionRequest, ConnectionRequestSchema } from './schemas/connection-request.schema';
import { NotificationsModule } from '../notifications/notifications.module';
import {
  User,
  UserSchema,
  IndividualUserSchema,
  LegalEntityUserSchema,
  UserType, // Import the enum for discriminator keys
} from './schemas/users.schema';
import { UserLoader } from './loaders/users.loader';
import { ConnectionRequestsService } from './connection-requests.service';
import { ConnectionRequestsResolver } from './connection-requests.resolver';
import { PubSubModule } from '../pubsub/pubsub.module';
import { PostsModule } from 'src/posts/posts.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: User.name, // Base model name
        schema: UserSchema,
        discriminators: [
          { name: UserType.INDIVIDUAL, schema: IndividualUserSchema },
          { name: UserType.LEGAL_ENTITY, schema: LegalEntityUserSchema },
        ],
      },
      { name: ConnectionRequest.name, schema: ConnectionRequestSchema }, // Register the ConnectionRequest model
    ]),
    forwardRef(() => NotificationsModule),
    forwardRef(() => PostsModule), // Importer PostsModule pour rendre les modèles Post et Comment disponibles
    PubSubModule,
  ],
  providers: [UsersResolver, UsersService, UserLoader, ConnectionRequestsService, ConnectionRequestsResolver],
  // Export MongooseModule to make UserModel available to other modules that import UsersModule.
  exports: [UsersService, UserLoader, MongooseModule],
})
export class UsersModule {}
