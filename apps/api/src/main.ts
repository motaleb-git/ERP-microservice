import "reflect-metadata";
import "./load-env";
import { loadApiEnv } from "@erp/config";
import { Logger as PinoLogger } from "nestjs-pino";
import { RequestMethod } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { ResponseInterceptor } from "./common/interceptors/response.interceptor";
import { setupOpenApi } from "./infrastructure/openapi/setup-openapi";
import { startTelemetry } from "./infrastructure/telemetry/telemetry";

async function bootstrap(): Promise<void> {
  const env = loadApiEnv();
  await startTelemetry(env);

  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  app.useLogger(app.get(PinoLogger));
  app.enableShutdownHooks();
  app.setGlobalPrefix(env.API_PREFIX, {
    exclude: [
      { path: "metrics", method: RequestMethod.GET },
      { path: "api/docs", method: RequestMethod.ALL },
      { path: "api/docs-json", method: RequestMethod.ALL },
    ],
  });
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.enableCors({
    origin: env.CORS_ORIGINS,
    credentials: true,
  });
  app.useBodyParser("json", { limit: env.BODY_LIMIT_JSON });
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());
  setupOpenApi(app, env.NODE_ENV);

  await app.listen(env.PORT);
}

bootstrap().catch((error: unknown) => {
  console.error("API failed to start");
  console.error(error instanceof Error ? error.message : "unknown error");
  process.exit(1);
});
