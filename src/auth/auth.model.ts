import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType()
export class CheckUserExistsResponse {
  @Field()
  exists: boolean;

  @Field()
  hasPassword: boolean;

  @Field(() => [String])
  providers: string[];
}
