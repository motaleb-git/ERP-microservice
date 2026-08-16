import { HealthService } from "./health.service";

describe("HealthService", () => {
  it("reports liveness without I/O", () => {
    const service = new HealthService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    expect(service.live()).toEqual({ status: "ok", service: "erp-api" });
  });
});
