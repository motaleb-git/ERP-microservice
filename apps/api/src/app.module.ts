import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { ClsModule } from "nestjs-cls";
import { newId } from "@erp/shared";
import { AppConfigModule } from "./infrastructure/config/app-config.module";
import { LoggerConfigModule } from "./infrastructure/logging/logger.module";
import { PrismaModule } from "./infrastructure/database/prisma.module";
import { RedisModule } from "./infrastructure/redis/redis.module";
import { RabbitMqModule } from "./infrastructure/rabbitmq/rabbitmq.module";
import { QueueModule } from "./infrastructure/queue/queue.module";
import { MetricsModule } from "./infrastructure/metrics/metrics.module";
import { HealthModule } from "./infrastructure/health/health.module";
import { SystemModule } from "./modules/system/system.module";

@Module({
  imports: [
    AppConfigModule,
    LoggerConfigModule,
    ClsModule.forRoot({
      global: true,
      middleware: {
        mount: true,
        generateId: true,
        idGenerator: (req: { headers: Record<string, string | string[] | undefined> }) => {
          const header = req.headers["x-correlation-id"];
          if (typeof header === "string" && header.length > 0) {
            return header;
          }
          return newId();
        },
      },
    }),
    PrismaModule,
    RedisModule,
    RabbitMqModule,
    QueueModule,
    ScheduleModule.forRoot(),
    MetricsModule,
    HealthModule,
    SystemModule,
  ],
})
export class AppModule {}
