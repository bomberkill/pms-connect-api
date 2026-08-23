import { ArgsType, Field, Int } from '@nestjs/graphql';
import { IsOptional, Max, Min } from 'class-validator';

@ArgsType()
export class PaginationArgs {
  @Field(() => Int, { defaultValue: 0, description: 'Number of items to skip' })
  @IsOptional()
  @Min(0)
  skip = 0;

  @Field(() => Int, {
    defaultValue: 10,
    description: 'Number of items to return',
  })
  @IsOptional()
  @Min(1)
  @Max(100)
  limit = 10;
}
