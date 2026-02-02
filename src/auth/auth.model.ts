import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType()
export class CheckUserExistsResponse {
  @Field({
    description: 'Indicates if a user with the given identifier exists.',
  })
  exists: boolean;

  @Field({
    description:
      'Indicates if the user has a password set as a sign-in method.',
  })
  hasPassword: boolean;

  @Field(() => [String], {
    description:
      'List of sign-in providers for the user (e.g., "password", "google.com").',
  })
  providers: string[];
}
