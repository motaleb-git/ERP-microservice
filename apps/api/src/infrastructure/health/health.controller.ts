import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { HealthService } from "./health.service";

@ApiTags("health")
@Controller()
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get("health")
  @ApiOperation({ summary: "Liveness probe" })
  live(): ReturnType<HealthService["live"]> {
    return this.health.live();
  }

  @Get("ready")
  @ApiOperation({ summary: "Readiness probe (Postgres, Redis, RabbitMQ)" })
  async ready(@Res({ passthrough: true }) response: Response) {
    const result = await this.health.ready();
    if (result.status !== "ok") {
      response.status(HttpStatus.SERVICE_UNAVAILABLE);
    }
    return result;
  }
}
