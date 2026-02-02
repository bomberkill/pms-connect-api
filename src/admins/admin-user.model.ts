import {
  ObjectType,
  Field,
  ID,
  registerEnumType,
  GraphQLISODateTime,
  Int,
} from '@nestjs/graphql';

// Mirror the Mongoose AdminRole enum for GraphQL
export enum AdminRoleGQL {
  SUPER_ADMIN = 'SUPER_ADMIN',
  CONTENT_MODERATOR = 'CONTENT_MODERATOR',
  USER_MANAGER = 'USER_MANAGER',
  SUPPORT_AGENT = 'SUPPORT_AGENT',
}

registerEnumType(AdminRoleGQL, {
  name: 'AdminRole', // This name will be used in your GraphQL schema
  description: 'Defines the roles for dashboard administrators.',
});

@ObjectType({ description: 'Represents a dashboard administrator user' })
export class AdminUser {
  @Field(() => ID)
  _id: string; // Mongoose _id is typically exposed as ID

  @Field()
  email: string;

  // IMPORTANT: passwordHash is NEVER exposed in the GraphQL API

  @Field()
  name: string;

  @Field(() => [AdminRoleGQL])
  roles: AdminRoleGQL[];

  @Field()
  isActive: boolean;

  @Field(() => GraphQLISODateTime, { nullable: true })
  lastLoginAt?: Date;

  @Field(() => Int, {
    description: 'Number of failed login attempts since last success',
  })
  failedLoginAttempts: number;

  @Field({ description: 'Indicates if the account is currently locked out' })
  isLockedOut: boolean;

  @Field(() => [String], {
    description: 'Specific permissions granted to the admin user',
  })
  permissions: string[];

  @Field(() => GraphQLISODateTime)
  createdAt: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt: Date;
}
