import { ArgsType, Field, Int } from '@nestjs/graphql';
import { IsOptional, Min, IsInt, IsEnum } from 'class-validator';
import { UserTypeGQL } from '../models/users.model';

@ArgsType()
export class GetAllUsersArgs {
  @Field(() => Int, { nullable: true, description: 'Number of items to skip' })
  @IsOptional()
  @Min(0)
  @IsInt()
  skip?: number = 0;

  @Field(() => Int, {
    nullable: true,
    description: 'Number of items to return',
  })
  @IsOptional()
  @Min(1)
  @IsInt()
  limit?: number = 10;

  @Field(() => UserTypeGQL, {
    nullable: true,
    description: 'Filter by user type',
  })
  @IsOptional()
  @IsEnum(UserTypeGQL)
  userType?: UserTypeGQL;
}
