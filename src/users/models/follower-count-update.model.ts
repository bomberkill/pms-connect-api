import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
class FollowerInfo {
  @Field(() => ID)
  userId: string;

  @Field(() => Int, {
    description: 'The new number of followers for this user.',
  })
  followersCount?: number;
}

@ObjectType()
class FollowingInfo {
  @Field(() => ID)
  userId: string;

  @Field(() => Int, {
    description: 'The new number of users this user is following.',
  })
  followingCount?: number;
}

@ObjectType()
export class FollowsUpdate {
  @Field(() => FollowerInfo)
  follower: FollowerInfo;

  @Field(() => FollowingInfo)
  following: FollowingInfo;
}
