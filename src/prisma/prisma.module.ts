import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// @Global so every feature module can inject PrismaService without each one
// re-importing PrismaModule individually (mirrors how MongooseModule.forRoot
// was registered once at the app root previously).
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
