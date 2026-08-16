import { z } from "zod";

export const eventEnvelopeSchema = z.object({
  id: z.string().uuid(),
  type: z.string().min(1),
  version: z.number().int().positive(),
  occurredAt: z.string().datetime(),
  organizationId: z.string().uuid().nullable(),
  aggregateType: z.string().min(1),
  aggregateId: z.string().uuid(),
  correlationId: z.string().min(1),
  causationId: z.string().min(1).nullable(),
  actorId: z.string().uuid().nullable(),
  payload: z.record(z.unknown()),
});

export type EventEnvelope = z.infer<typeof eventEnvelopeSchema>;

export function routingKey(type: string, version: number): string {
  return `${type}.v${version}`;
}

export function createEventEnvelope(
  input: Omit<EventEnvelope, "occurredAt"> & { occurredAt?: string },
): EventEnvelope {
  return eventEnvelopeSchema.parse({
    ...input,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
  });
}
