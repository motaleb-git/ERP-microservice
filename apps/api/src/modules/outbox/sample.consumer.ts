import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import type { ConsumeMessage } from "amqplib";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import { RabbitMqService } from "../../infrastructure/rabbitmq/rabbitmq.service";
import { QUEUE_SAMPLE } from "../../infrastructure/rabbitmq/topology";

@Injectable()
export class SampleConsumer implements OnModuleInit {
  private readonly logger = new Logger(SampleConsumer.name);
  private readonly consumerName = "platform.sample";

  constructor(
    private readonly rabbit: RabbitMqService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.rabbit.consume(QUEUE_SAMPLE, (message) => this.handle(message));
    this.logger.log(`consuming ${QUEUE_SAMPLE}`);
  }

  private async handle(message: ConsumeMessage): Promise<void> {
    const eventId = message.properties.messageId;
    if (!eventId) {
      this.logger.warn("sample_event_missing_id");
      return;
    }

    try {
      await this.prisma.inboxMessage.create({
        data: {
          eventId,
          consumerName: this.consumerName,
        },
      });
      this.logger.log(`sample_event_processed id=${eventId}`);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        this.logger.log(`sample_event_duplicate id=${eventId}`);
        return;
      }
      throw error;
    }
  }
}
