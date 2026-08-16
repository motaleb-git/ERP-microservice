import type { ApiEnv } from "@erp/config";

export async function startTelemetry(env: ApiEnv): Promise<void> {
  if (!env.OTEL_ENABLED) {
    return;
  }
  // Phase 1 stub: enable OpenTelemetry SDK in a later phase when exporters are configured.
}
