import { Field, GraphQLISODateTime, InputType } from '@nestjs/graphql';
import { IsBoolean, IsDate, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

@InputType()
export class CreateProfessionalExperienceInput {
  @Field()
  @IsString()
  @IsNotEmpty()
  title: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  organizationName: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  employmentType?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  location?: string;

  @Field(() => GraphQLISODateTime)
  @Type(() => Date)
  @IsDate()
  startDate: Date;

  @Field(() => GraphQLISODateTime, { nullable: true })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endDate?: Date;

  @Field({ defaultValue: false })
  @IsBoolean()
  isCurrent: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;
}
