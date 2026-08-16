import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { Inject } from "@nestjs/common";
import type { ApiEnv } from "@erp/config";
import { routingKey } from "@erp/shared";
import { APP_CONFIG } from "../../infrastructure/config/app-config.module";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import { RabbitMqService } from "../../infrastructure/rabbitmq/rabbitmq.service";

type OutboxRow = {
  id: string;
  event_type: string;
  event_version: number;
  payload_jsonb: unknown;
  correlation_id: string;
};

@Injectable()
export class OutboxPublisher {
  private readonly logger = new Logger(OutboxPublisher.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbit: RabbitMqService,
    @Inject(APP_CONFIG) private readonly env: ApiEnv,
  ) {}

  @Cron("*/1 * * * * *")
  async tick(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;
    try {
      await this.publishBatch();
    } catch (error) {
      this.logger.error("outbox_publish_failed");
      if (error instanceof Error) {
        this.logger.error(error.message);
      }
    } finally {
      this.running = false;
    }
  }

  async publishBatch(): Promise<number> {
    const batch = await this.prisma.$transaction(async (tx) => {
      return tx.$queryRaw<OutboxRow[]>`
        WITH picked AS (
          SELECT id
          FROM platform.outbox_events
          WHERE published_at IS NULL
          ORDER BY created_at
          LIMIT ${this.env.OUTBOX_BATCH_SIZE}
          FOR UPDATE SKIP LOCKED
        )
        UPDATE platform.outbox_events AS o
        SET publish_attempts = o.publish_attempts + 1
        FROM picked
        WHERE o.id = picked.id
        RETURNING o.id, o.event_type, o.event_version, o.payload_jsonb, o.correlation_id
      `;
    });

    let published = 0;
    for (const row of batch) {
      const key = routingKey(row.event_type, row.event_version);
      await this.rabbit.publish(key, row.payload_jsonb, row.correlation_id);
      await this.prisma.outboxEvent.update({
        where: { id: row.id },
        data: { publishedAt: new Date() },
      });
      published += 1;
    }
    return published;
  }
}
