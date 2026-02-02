import { InputType, Field } from '@nestjs/graphql';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsEnum,
  ValidateNested,
  IsOptional,
  IsUrl,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  UserTypeGQL,
  SpecialityGQL,
  EntityTypeGQL,
} from '../models/users.model'; // Import GraphQL types/enums

@InputType()
export class ProfessionalAccreditationInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  accreditationType?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  referenceNumber?: string;

  @Field()
  @IsOptional()
  @IsNotEmpty()
  @IsUrl()
  documentUrl: string;

  @Field({ nullable: true })
  @IsOptional()
  issueDate?: Date; // GraphQLISODateTime maps to Date

  @Field({ nullable: true })
  @IsOptional()
  expirationDate?: Date; // GraphQLISODateTime maps to Date

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  issuingAuthority?: string;
}

@InputType()
export class LocationInput {
  @Field({ nullable: true }) @IsOptional() @IsString() addressLine1?: string;
  @Field({ nullable: true }) @IsOptional() @IsString() addressLine2?: string;
  @Field({ nullable: true }) @IsOptional() @IsString() city?: string;
  @Field({ nullable: true }) @IsOptional() @IsString() stateOrProvince?: string;
  @Field({ nullable: true }) @IsOptional() @IsString() postalCode?: string;
  @Field() @IsNotEmpty() @IsString() country: string;
}

@InputType()
export class CreateUserInput {
  //   @Field(() => ID)
  //   @IsNotEmpty()
  //   @IsString()
  //   firebaseUid: string; // Required from Firebase Auth

  @Field()
  @IsNotEmpty()
  @IsEmail()
  email: string; // Required from Firebase Auth

  @Field()
  @IsNotEmpty()
  @IsString()
  phoneNumber: string;

  @Field(() => [String], {
    description:
      'Authentication providers used for sign-up (e.g., ["password"], ["google.com"])',
  })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  providers: string[];

  @Field(() => UserTypeGQL)
  @IsEnum(UserTypeGQL)
  userType: UserTypeGQL;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  profilePicUrl?: string;

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
  @Type(() => LocationInput) // Needed for nested validation
  @ValidateNested()
  location?: LocationInput;

  @Field({ nullable: true })
  @IsOptional()
  @IsUrl()
  websiteUrl?: string;

  @Field(() => [ProfessionalAccreditationInput], { nullable: true })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true }) // Validate each item in the array
  @Type(() => ProfessionalAccreditationInput) // Needed for nested validation
  professionalAccreditation?: ProfessionalAccreditationInput[];

  // Fields specific to IndividualUser (only include if userType is INDIVIDUAL)
  @Field({ nullable: true }) @IsOptional() @IsString() firstName?: string;
  @Field({ nullable: true }) @IsOptional() @IsString() lastName?: string;
  @Field(() => SpecialityGQL, { nullable: true })
  @IsOptional()
  @IsEnum(SpecialityGQL)
  speciality?: SpecialityGQL;
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  professionalTitle?: string;

  // Fields specific to LegalEntityUser (only include if userType is LEGAL_ENTITY)
  @Field({ nullable: true }) @IsOptional() @IsString() entityName?: string;
  @Field(() => EntityTypeGQL, { nullable: true })
  @IsOptional()
  @IsEnum(EntityTypeGQL)
  entityType?: EntityTypeGQL;
}
