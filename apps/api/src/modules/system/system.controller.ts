import { Controller, ForbiddenException, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { SystemService } from "./system.service";

@ApiTags("system")
@Controller("system")
export class SystemController {
  constructor(private readonly system: SystemService) {}

  @Post("outbox-sample")
  @ApiOperation({
    summary: "Enqueue a sample outbox event (development only)",
  })
  async sample() {
    if (!this.system.sampleEndpointsEnabled()) {
      throw new ForbiddenException("Sample endpoints are disabled");
    }
    return this.system.enqueueSampleEvent();
  }
}
