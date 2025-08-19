import { InputType, Field } from '@nestjs/graphql';
import { IsEmail, IsNotEmpty, MinLength, IsString } from 'class-validator';

@InputType()
export class RequestAdminPasswordResetInput {
  @Field()
  @IsNotEmpty({ message: 'Email is required.' })
  @IsEmail({}, { message: 'Email must be a valid email address.' })
  email: string;
}

@InputType()
export class ResetAdminPasswordInput {
  @Field()
  @IsNotEmpty({ message: 'Reset token is required.' })
  @IsString()
  token: string;

  @Field()
  @IsNotEmpty({ message: 'New password is required.' })
  @MinLength(8, { message: 'New password must be at least 8 characters long.' })
  newPassword: string;
}
