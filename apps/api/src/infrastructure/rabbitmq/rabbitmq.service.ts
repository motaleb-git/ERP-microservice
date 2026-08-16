import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Inject } from "@nestjs/common";
import type { ApiEnv } from "@erp/config";
import amqp from "amqplib";
import { APP_CONFIG } from "../config/app-config.module";
import {
  EXCHANGE_DLX,
  EXCHANGE_EVENTS,
  EXCHANGE_RETRY,
  QUEUE_DEAD,
  QUEUE_SAMPLE,
  SAMPLE_ROUTING_KEY,
} from "./topology";

@Injectable()
export class RabbitMqService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMqService.name);
  private connection: Awaited<ReturnType<typeof amqp.connect>> | undefined;
  private channel: amqp.Channel | undefined;

  constructor(@Inject(APP_CONFIG) private readonly env: ApiEnv) {}

  async onModuleInit(): Promise<void> {
    await this.connect();
    await this.assertTopology();
  }

  async onModuleDestroy(): Promise<void> {
    await this.channel?.close();
    await this.connection?.close();
  }

  isConnected(): boolean {
    return Boolean(this.channel);
  }

  async ping(): Promise<void> {
    if (!this.channel) {
      throw new Error("RabbitMQ channel is not open");
    }
    await this.channel.checkExchange(this.env.RABBITMQ_EXCHANGE || EXCHANGE_EVENTS);
  }

  async publish(routingKey: string, payload: unknown, correlationId: string): Promise<void> {
    if (!this.channel) {
      throw new Error("RabbitMQ channel is not open");
    }
    const body = Buffer.from(JSON.stringify(payload), "utf8");
    const ok = this.channel.publish(EXCHANGE_EVENTS, routingKey, body, {
      persistent: true,
      contentType: "application/json",
      correlationId,
      messageId:
        typeof payload === "object" && payload !== null && "id" in payload
          ? String((payload as { id: unknown }).id)
          : undefined,
    });
    if (!ok) {
      throw new Error("RabbitMQ publish buffer full");
    }
  }

  async consume(
    queue: string,
    handler: (message: amqp.ConsumeMessage) => Promise<void>,
  ): Promise<void> {
    if (!this.channel) {
      throw new Error("RabbitMQ channel is not open");
    }
    await this.channel.consume(
      queue,
      async (message) => {
        if (!message) {
          return;
        }
        try {
          await handler(message);
          this.channel?.ack(message);
        } catch {
          this.logger.error(`consumer_failed queue=${queue}`);
          this.channel?.nack(message, false, false);
        }
      },
      { noAck: false },
    );
  }

  private async connect(): Promise<void> {
    this.connection = await amqp.connect(this.env.RABBITMQ_URL);
    this.channel = await this.connection.createChannel();
    await this.channel.prefetch(20);
    this.connection.on("close", () => {
      this.logger.warn("rabbitmq_connection_closed");
      this.channel = undefined;
    });
  }

  private async assertTopology(): Promise<void> {
    if (!this.channel) {
      return;
    }
    await this.channel.assertExchange(EXCHANGE_EVENTS, "topic", { durable: true });
    await this.channel.assertExchange(EXCHANGE_RETRY, "topic", { durable: true });
    await this.channel.assertExchange(EXCHANGE_DLX, "fanout", { durable: true });
    await this.channel.assertQueue(QUEUE_DEAD, { durable: true });
    await this.channel.bindQueue(QUEUE_DEAD, EXCHANGE_DLX, "");
    await this.channel.assertQueue(QUEUE_SAMPLE, {
      durable: true,
      arguments: {
        "x-dead-letter-exchange": EXCHANGE_DLX,
      },
    });
    await this.channel.bindQueue(QUEUE_SAMPLE, EXCHANGE_EVENTS, SAMPLE_ROUTING_KEY);
  }
}
