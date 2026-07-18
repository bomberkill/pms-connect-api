import { ArgsType, Field, ID } from '@nestjs/graphql';
import { IsEnum, IsString, IsOptional } from 'class-validator';
import { PaginationArgs } from '../../posts/dto/pagination.args';
import { ConnectionRequestStatus } from '../schemas/connection-request.schema';

@ArgsType()
export class GetConnectionRequestsArgs extends PaginationArgs {
  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsString()
  requesterId?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsString()
  recipientId?: string;

  @Field(() => ConnectionRequestStatus, { nullable: true })
  @IsOptional()
  @IsEnum(ConnectionRequestStatus)
  status?: ConnectionRequestStatus;
}
