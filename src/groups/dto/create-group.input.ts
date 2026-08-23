import { InputType, Field } from '@nestjs/graphql';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsArray,
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

  @Field({ nullable: true, defaultValue: false })
  @IsOptional()
  @IsBoolean()
  postsRequireApproval?: boolean;

  @Field({ nullable: true, defaultValue: false })
  @IsOptional()
  @IsBoolean()
  restrictToVerifiedTitles?: boolean;

  @Field(() => [String], { nullable: 'itemsAndList' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  rules?: string[];
}
