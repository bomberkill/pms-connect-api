import { Global, Module } from '@nestjs/common';
import { DataloaderService } from './dataloader.service';

@Global()
@Module({
  providers: [DataloaderService],
  exports: [DataloaderService],
})
export class DataloaderModule {}
