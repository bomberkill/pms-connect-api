import { ObjectType, Field, Int } from '@nestjs/graphql';

@ObjectType('NotificationPreference')
export class NotificationPreferenceGQL {
  @Field()
  notifyReplies: boolean;

  @Field()
  notifyMentions: boolean;

  @Field()
  notifyConnectionRequests: boolean;

  @Field()
  notifyReactions: boolean;

  @Field()
  notifyGroupActivity: boolean;

  @Field()
  notifyEstablishmentAnnouncements: boolean;

  @Field()
  quietHoursEnabled: boolean;

  @Field(() => Int, { nullable: true })
  quietHoursStart: number | null;

  @Field(() => Int, { nullable: true })
  quietHoursEnd: number | null;

  @Field()
  weeklyEmailDigest: boolean;
}
