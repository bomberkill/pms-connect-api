import { InputType, Field } from '@nestjs/graphql';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  IsArray,
  IsEnum,
  IsOptional,
  IsBoolean,
} from 'class-validator';
import { AdminRoleGQL } from '../admin-user.model';

@InputType()
export class CreateAdminUserInput {
  @Field()
  @IsNotEmpty({ message: 'Email is required.' })
  @IsEmail({}, { message: 'Email must be a valid email address.' })
  email: string;

  @Field()
  @IsNotEmpty({ message: 'Password is required.' })
  @MinLength(8, { message: 'Password must be at least 8 characters long.' })
  password: string; // This will be hashed by the Mongoose pre-save hook

  @Field()
  @IsNotEmpty({ message: 'Name is required.' })
  @IsString()
  name: string;

  @Field(() => [AdminRoleGQL], { defaultValue: [AdminRoleGQL.SUPPORT_AGENT] })
  @IsOptional()
  @IsArray()
  @IsEnum(AdminRoleGQL, { each: true, message: 'Invalid role provided.' })
  roles?: AdminRoleGQL[];

  @Field({ nullable: true, defaultValue: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @Field(() => [String], { nullable: true, defaultValue: [] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];
}