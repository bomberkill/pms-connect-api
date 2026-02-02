import { Module, Global } from '@nestjs/common';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
// import * as redisStore from 'cache-manager-redis-store';

@Global()
@Module({
  imports: [
    NestCacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async () => {
        // Redis configuration (Commented out for future sprint)
        /*
        const redisHost = configService.get<string>('REDIS_HOST', 'localhost');
        const redisPort = configService.get<number>('REDIS_PORT', 6379);

        try {
          return {
            store: redisStore,
            host: redisHost,
            port: redisPort,
            ttl: 300, // 5 minutes default
            max: 1000, // Maximum number of items in cache
            isGlobal: true,
          };
        } catch {
          console.warn(
            '⚠️  Redis connection failed, falling back to in-memory cache',
          );
        }
        */

        // Default in-memory cache
        return {
          ttl: 300,
          max: 100,
          isGlobal: true,
        };
      },
    }),
  ],
  exports: [NestCacheModule],
})
export class CacheModule {}
