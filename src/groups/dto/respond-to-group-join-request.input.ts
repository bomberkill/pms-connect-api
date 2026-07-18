import { Field, ID, InputType } from '@nestjs/graphql';
import { IsString } from 'class-validator';

@InputType()
export class RespondToGroupJoinRequestInput {
  @Field(() => ID)
  @IsString()
  requestId: string;
}
