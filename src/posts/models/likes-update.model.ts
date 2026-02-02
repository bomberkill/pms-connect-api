import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class LikesUpdate {
  @Field(() => ID)
  likeableId: string;

  @Field()
  likeableType: string;

  @Field(() => Int)
  likesCount: number;
}
