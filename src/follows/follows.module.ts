import { Module } from '@nestjs/common';
import { FollowsService } from './follows.service';

@Module({
  providers: [FollowsService],
  exports: [FollowsService],
})
export class FollowsModule {}
