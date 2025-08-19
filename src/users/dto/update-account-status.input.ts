import { InputType, Field, ID } from '@nestjs/graphql';
import { IsNotEmpty, IsString, IsEnum } from 'class-validator';
import { AccountStatusGQL } from '../users.model';

@InputType()
export class UpdateAccountStatusInput {
  @Field(() => ID)
  @IsNotEmpty()
  @IsString()
  userId: string;

  @Field(() => AccountStatusGQL)
  @IsEnum(AccountStatusGQL)
  accountStatus: AccountStatusGQL;
}