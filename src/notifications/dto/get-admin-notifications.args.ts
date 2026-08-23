import { ArgsType, Field, ID } from '@nestjs/graphql';
import { IsBoolean, IsEnum, IsString, IsOptional } from 'class-validator';
import { PaginationArgs } from '../../posts/dto/pagination.args';
import { NotificationType } from '../schemas/notification.schema';

@ArgsType()
export class GetAdminNotificationsArgs extends PaginationArgs {
  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsString()
  recipientId?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsString()
  senderId?: string;

  @Field(() => NotificationType, { nullable: true })
  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  read?: boolean;
}
