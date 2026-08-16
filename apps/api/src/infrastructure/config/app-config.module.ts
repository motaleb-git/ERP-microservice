import { Global, Module } from "@nestjs/common";
import { loadApiEnv, type ApiEnv } from "@erp/config";

export const APP_CONFIG = Symbol("APP_CONFIG");

@Global()
@Module({
  providers: [
    {
      provide: APP_CONFIG,
      useFactory: (): ApiEnv => loadApiEnv(),
    },
  ],
  exports: [APP_CONFIG],
})
export class AppConfigModule {}
