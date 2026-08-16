import { Controller, Get, Header } from "@nestjs/common";
import client from "prom-client";

client.collectDefaultMetrics({ prefix: "erp_" });

export const httpRequestCounter = new client.Counter({
  name: "erp_http_requests_total",
  help: "HTTP requests",
  labelNames: ["method", "route", "status"] as const,
});

@Controller()
export class MetricsController {
  @Get("metrics")
  @Header("Content-Type", "text/plain; version=0.0.4")
  async metrics(): Promise<string> {
    return client.register.metrics();
  }
}
