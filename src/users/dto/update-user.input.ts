import { InputType, Field, PartialType, OmitType } from '@nestjs/graphql';
import { CreateUserInput } from './create-user.input';
import {
  IsOptional,
  IsString,
  IsUrl,
  ValidateNested,
  IsArray,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  LocationInput,
  ProfessionalAccreditationInput,
} from './create-user.input'; // Re-use from CreateUserInput
import { AccountStatusGQL, SpecialityGQL, EntityTypeGQL } from '../models/users.model';

// UpdateUserInput will allow partial updates. We can omit fields that shouldn't be updatable this way,
// like email (which often has a separate verification flow) or userType.
@InputType()
export class UpdateUserInput extends PartialType(
  OmitType(CreateUserInput, ['email', 'userType'] as const),
) {
  // Override fields if their validation/type needs to be different for update
  // For example, making fields explicitly optional if not already handled by PartialType

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  profilePicUrl?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  coverPicUrl?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  bio?: string;

  @Field(() => LocationInput, { nullable: true })
  @IsOptional()
  @Type(() => LocationInput)
  @ValidateNested()
  location?: LocationInput;

  @Field({ nullable: true })
  @IsOptional()
  @IsUrl()
  websiteUrl?: string;

  @Field(() => [ProfessionalAccreditationInput], { nullable: true })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProfessionalAccreditationInput)
  professionalAccreditation?: ProfessionalAccreditationInput[];

  // Specific fields like firstName, lastName, speciality, entityName, entityType
  // are already handled by inheriting from CreateUserInput and PartialType.
  // We don't need to redefine them unless their update logic is very different.
}