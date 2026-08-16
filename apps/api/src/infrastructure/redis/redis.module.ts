import { Global, Module } from "@nestjs/common";
import Redis from "ioredis";
import type { ApiEnv } from "@erp/config";
import { APP_CONFIG } from "../config/app-config.module";
import { REDIS_CACHE, REDIS_QUEUE } from "./redis.constants";
import { RedisLifecycle } from "./redis.lifecycle";

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CACHE,
      inject: [APP_CONFIG],
      useFactory: (env: ApiEnv): Redis =>
        new Redis(env.REDIS_CACHE_URL, {
          maxRetriesPerRequest: 3,
          enableReadyCheck: true,
        }),
    },
    {
      provide: REDIS_QUEUE,
      inject: [APP_CONFIG],
      useFactory: (env: ApiEnv): Redis =>
        new Redis(env.REDIS_QUEUE_URL, {
          maxRetriesPerRequest: null,
          enableReadyCheck: true,
        }),
    },
    RedisLifecycle,
  ],
  exports: [REDIS_CACHE, REDIS_QUEUE],
})
export class RedisModule {}
