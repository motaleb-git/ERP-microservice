import "reflect-metadata";
import "./load-env";
import { loadApiEnv } from "@erp/config";
import { Logger as PinoLogger } from "nestjs-pino";
import { NestFactory } from "@nestjs/core";
import { WorkerModule } from "./worker.module";
import { startTelemetry } from "./infrastructure/telemetry/telemetry";

async function bootstrap(): Promise<void> {
  const env = loadApiEnv();
  await startTelemetry(env);
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(PinoLogger));
  app.enableShutdownHooks();
}

bootstrap().catch((error: unknown) => {
  console.error("Worker failed to start");
  console.error(error instanceof Error ? error.message : "unknown error");
  process.exit(1);
});
