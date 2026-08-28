import { Field, GraphQLISODateTime, InputType, PartialType } from '@nestjs/graphql';
import { IsDate, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateProfessionalExperienceInput } from './create-professional-experience.input';

@InputType()
export class UpdateProfessionalExperienceInput extends PartialType(
  CreateProfessionalExperienceInput,
) {
  @Field(() => GraphQLISODateTime, { nullable: true })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startDate?: Date;

  @Field(() => GraphQLISODateTime, { nullable: true })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endDate?: Date;
}
