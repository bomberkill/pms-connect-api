import { Module } from '@nestjs/common';
import { UsersResolver } from './users.resolver';
import { UsersService } from './users.service';
import { MongooseModule } from '@nestjs/mongoose';
import {
  User,
  UserSchema,
  IndividualUserSchema,
  LegalEntityUserSchema,
  UserType, // Import the enum for discriminator keys
} from './users.schema';

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
    ]),
  ],
  providers: [UsersResolver, UsersService],
  exports: [UsersService], // Export if other modules need UsersService (e.g., AuthModule later)
})
export class UsersModule {}
