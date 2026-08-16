import { Inject, Injectable } from "@nestjs/common";
import type { ApiEnv } from "@erp/config";
import { createEventEnvelope, newId, routingKey } from "@erp/shared";
import { ClsService } from "nestjs-cls";
import { APP_CONFIG } from "../../infrastructure/config/app-config.module";
import { PrismaService } from "../../infrastructure/database/prisma.service";

@Injectable()
export class SystemService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
    @Inject(APP_CONFIG) private readonly env: ApiEnv,
  ) {}

  async enqueueSampleEvent(): Promise<{ eventId: string; routingKey: string }> {
    const eventId = newId();
    const correlationId = this.cls.getId() ?? eventId;
    const envelope = createEventEnvelope({
      id: eventId,
      type: "platform.sample.created",
      version: 1,
      organizationId: null,
      aggregateType: "PlatformSample",
      aggregateId: eventId,
      correlationId,
      causationId: null,
      actorId: null,
      payload: { source: "system.sample" },
    });

    await this.prisma.outboxEvent.create({
      data: {
        id: envelope.id,
        organizationId: envelope.organizationId,
        aggregateType: envelope.aggregateType,
        aggregateId: envelope.aggregateId,
        eventType: envelope.type,
        eventVersion: envelope.version,
        payload: JSON.parse(JSON.stringify(envelope)) as object,
        correlationId: envelope.correlationId,
        causationId: envelope.causationId,
        actorId: envelope.actorId,
      },
    });

    return { eventId, routingKey: routingKey(envelope.type, envelope.version) };
  }

  sampleEndpointsEnabled(): boolean {
    return this.env.SAMPLE_ENDPOINTS_ENABLED;
  }
}
