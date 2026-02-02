import { InputType, Field } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';

@InputType()
export class VerifyAdminTokenInput {
  @Field()
  @IsNotEmpty({ message: 'Admin token is required.' })
  @IsString()
  token: string;
}
