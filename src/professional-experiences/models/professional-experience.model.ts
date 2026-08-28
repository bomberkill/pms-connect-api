import { Field, GraphQLISODateTime, ID, ObjectType } from '@nestjs/graphql';

@ObjectType('ProfessionalExperience')
export class ProfessionalExperienceGQL {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  userId: string;

  @Field()
  title: string;

  @Field()
  organizationName: string;

  @Field({ nullable: true })
  employmentType?: string;

  @Field({ nullable: true })
  location?: string;

  @Field(() => GraphQLISODateTime)
  startDate: Date;

  @Field(() => GraphQLISODateTime, { nullable: true })
  endDate?: Date;

  @Field()
  isCurrent: boolean;

  @Field({ nullable: true })
  description?: string;

  @Field(() => GraphQLISODateTime)
  createdAt: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt: Date;
}
