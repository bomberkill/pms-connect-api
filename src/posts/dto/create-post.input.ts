import { InputType, Field } from '@nestjs/graphql';
import { IsString, IsNotEmpty, IsOptional, IsUrl, IsEnum, ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import { PostStatus } from '../schemas/posts.schema';

@InputType()
export class MediaItemInput {
  @Field()
  @IsUrl()
  @IsNotEmpty()
  url: string;

  @Field()
  @IsEnum(['IMAGE', 'VIDEO', 'DOCUMENT'])
  type: string;
}

@InputType()
export class CreatePostInput {
  @Field()
  @IsString()
  @IsNotEmpty()
  content: string;

  @Field(() => [MediaItemInput], { nullable: 'itemsAndList' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MediaItemInput)
  media?: MediaItemInput[];

  @Field(() => PostStatus, { nullable: true, description: 'Defaults to PUBLISHED if not provided.' })
  @IsOptional()
  @IsEnum(PostStatus)
  status?: PostStatus;

}