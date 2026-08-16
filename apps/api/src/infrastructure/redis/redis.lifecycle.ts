import { Inject, Injectable, OnModuleDestroy } from "@nestjs/common";
import Redis from "ioredis";
import { REDIS_CACHE, REDIS_QUEUE } from "./redis.constants";

@Injectable()
export class RedisLifecycle implements OnModuleDestroy {
  constructor(
    @Inject(REDIS_CACHE) private readonly cache: Redis,
    @Inject(REDIS_QUEUE) private readonly queue: Redis,
  ) {}

  async onModuleDestroy(): Promise<void> {
    await Promise.all([this.cache.quit(), this.queue.quit()]);
  }
}
