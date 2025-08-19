import { InputType, Field, PartialType, OmitType, ID } from '@nestjs/graphql';
import { CreateAdminUserInput } from './create-admin-user.input';
import {
  IsEmail,
  IsOptional,
  IsString,
  IsArray,
  IsEnum,
  IsBoolean,
} from 'class-validator';
import { AdminRoleGQL } from '../admin-user.model';

// For updates, we typically don't update the password directly with other fields.
// Password changes should be a separate, more secure operation.
@InputType()
export class UpdateAdminUserInput extends PartialType(
  OmitType(CreateAdminUserInput, ['password'] as const),
) {
  @Field({ nullable: true })
  @IsOptional()
  @IsEmail({}, { message: 'Email must be a valid email address.' })
  email?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  name?: string;

  @Field(() => [AdminRoleGQL], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsEnum(AdminRoleGQL, { each: true, message: 'Invalid role provided.' })
  roles?: AdminRoleGQL[];

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];
}