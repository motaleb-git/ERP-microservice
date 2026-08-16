import { Inject, Injectable } from "@nestjs/common";
import Redis from "ioredis";
import { PrismaService } from "../database/prisma.service";
import { REDIS_CACHE, REDIS_QUEUE } from "../redis/redis.constants";
import { RabbitMqService } from "../rabbitmq/rabbitmq.service";
import type { HealthStatus, ReadinessCheck, ReadinessStatus } from "@erp/types";

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CACHE) private readonly redisCache: Redis,
    @Inject(REDIS_QUEUE) private readonly redisQueue: Redis,
    private readonly rabbit: RabbitMqService,
  ) {}

  live(): HealthStatus {
    return { status: "ok", service: "erp-api" };
  }

  async ready(): Promise<ReadinessStatus> {
    const checks = {
      postgres: await this.probe(async () => {
        await this.prisma.$queryRaw`SELECT 1`;
      }),
      redisCache: await this.probe(async () => {
        await this.redisCache.ping();
      }),
      redisQueue: await this.probe(async () => {
        await this.redisQueue.ping();
      }),
      rabbitmq: await this.probe(async () => {
        await this.rabbit.ping();
      }),
    };

    const status = Object.values(checks).every((item) => item === "up") ? "ok" : "degraded";
    return { status, checks };
  }

  private async probe(fn: () => Promise<void>): Promise<ReadinessCheck> {
    try {
      await fn();
      return "up";
    } catch {
      return "down";
    }
  }
}
