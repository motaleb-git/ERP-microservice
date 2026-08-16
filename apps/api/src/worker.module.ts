import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { AppConfigModule } from "./infrastructure/config/app-config.module";
import { LoggerConfigModule } from "./infrastructure/logging/logger.module";
import { PrismaModule } from "./infrastructure/database/prisma.module";
import { RedisModule } from "./infrastructure/redis/redis.module";
import { RabbitMqModule } from "./infrastructure/rabbitmq/rabbitmq.module";
import { QueueModule } from "./infrastructure/queue/queue.module";
import { OutboxModule } from "./modules/outbox/outbox.module";

@Module({
  imports: [
    AppConfigModule,
    LoggerConfigModule,
    PrismaModule,
    RedisModule,
    RabbitMqModule,
    QueueModule,
    ScheduleModule.forRoot(),
    OutboxModule,
  ],
})
export class WorkerModule {}
