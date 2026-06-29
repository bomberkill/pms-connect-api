import { Field, ID, InputType } from '@nestjs/graphql';
import { IsMongoId } from 'class-validator';

@InputType()
export class RespondToGroupJoinRequestInput {
  @Field(() => ID)
  @IsMongoId()
  requestId: string;
}
