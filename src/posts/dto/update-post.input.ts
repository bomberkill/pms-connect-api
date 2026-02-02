import { InputType, Field } from '@nestjs/graphql';
import { IsString, IsOptional, IsEnum, IsNotEmpty } from 'class-validator';
import { PostStatus } from '../schemas/posts.schema';

@InputType()
export class UpdatePostInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  content?: string;

  @Field(() => PostStatus, { nullable: true })
  @IsOptional()
  @IsEnum(PostStatus)
  status?: PostStatus;
}
