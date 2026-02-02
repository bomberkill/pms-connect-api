import { InputType, Field } from '@nestjs/graphql';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  MaxLength,
} from 'class-validator';
import { GroupPrivacy } from '../schemas/group.schema';

@InputType()
export class CreateGroupInput {
  @Field()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @Field(() => GroupPrivacy, {
    nullable: true,
    defaultValue: GroupPrivacy.PUBLIC,
  })
  @IsOptional()
  @IsEnum(GroupPrivacy)
  privacy?: GroupPrivacy;
}
