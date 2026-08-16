import { routingKey } from "@erp/shared";
import { SystemService } from "./system.service";

describe("SystemService", () => {
  it("writes an outbox envelop and returns a versioned routing key", async () => {
    const create = jest.fn().mockResolvedValue({});
    const service = new SystemService(
      { outboxEvent: { create } } as never,
      { getId: () => "corr-1" } as never,
      { SAMPLE_ENDPOINTS_ENABLED: true } as never,
    );

    const result = await service.enqueueSampleEvent();
    expect(result.routingKey).toBe(routingKey("platform.sample.created", 1));
    expect(create).toHaveBeenCalledTimes(1);
    const arg = create.mock.calls[0][0] as { data: { eventType: string; correlationId: string } };
    expect(arg.data.eventType).toBe("platform.sample.created");
    expect(arg.data.correlationId).toBe("corr-1");
  });
});
