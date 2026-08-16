import { Module } from "@nestjs/common";
import { LoggerModule } from "nestjs-pino";
import type { ApiEnv } from "@erp/config";
import { newId } from "@erp/shared";
import { APP_CONFIG, AppConfigModule } from "../config/app-config.module";

@Module({
  imports: [
    AppConfigModule,
    LoggerModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (env: ApiEnv) => ({
        pinoHttp: {
          level: env.LOG_LEVEL,
          genReqId: (req, res) => {
            const existing = req.headers["x-correlation-id"];
            const id = typeof existing === "string" && existing.length > 0 ? existing : newId();
            res.setHeader("x-correlation-id", id);
            return id;
          },
          serializers: {
            req: (req) => ({
              method: req.method,
              url: req.url,
            }),
            res: (res) => ({
              statusCode: res.statusCode,
            }),
          },
          redact: {
            paths: [
              "req.headers.authorization",
              "req.headers.cookie",
              "password",
              "passwordHash",
              "token",
              "refreshToken",
            ],
            censor: "[Redacted]",
          },
          transport:
            env.NODE_ENV === "development"
              ? { target: "pino-pretty", options: { singleLine: true, colorize: true } }
              : undefined,
        },
      }),
    }),
  ],
})
export class LoggerConfigModule {}
