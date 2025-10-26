import { InputType, Field, ID } from '@nestjs/graphql';
import { IsString, IsNotEmpty, IsMongoId, IsOptional, ValidateNested, IsArray } from 'class-validator';
import { MediaItemInput } from './create-post.input';
import { Type } from 'class-transformer';

@InputType()
export class CreateCommentInput {
  @Field(() => ID)
  @IsNotEmpty()
  @IsMongoId()
  postId: string;

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

  @Field(() => ID, {nullable: true})
  @IsOptional()
  parentId?: string;
}