import { z } from "zod";

const nodeEnv = z.enum(["development", "test", "production"]);

export const apiEnvSchema = z.object({
  NODE_ENV: nodeEnv.default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  API_PREFIX: z.string().default("api/v1"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  DATABASE_URL: z.string().min(1),
  REDIS_CACHE_URL: z.string().min(1),
  REDIS_QUEUE_URL: z.string().min(1),
  RABBITMQ_URL: z.string().min(1),
  RABBITMQ_EXCHANGE: z.string().default("erp.events"),
  MINIO_ENDPOINT: z.string().min(1),
  MINIO_PORT: z.coerce.number().int().positive().default(9000),
  MINIO_USE_SSL: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  MINIO_ACCESS_KEY: z.string().min(1),
  MINIO_SECRET_KEY: z.string().min(8),
  MINIO_BUCKET: z.string().default("erp"),
  CORS_ORIGINS: z
    .string()
    .default("http://localhost:3000")
    .transform((value) =>
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  BODY_LIMIT_JSON: z.string().default("1mb"),
  SAMPLE_ENDPOINTS_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  OTEL_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  OUTBOX_BATCH_SIZE: z.coerce.number().int().positive().default(50),
  OUTBOX_POLL_MS: z.coerce.number().int().positive().default(1000),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(14),
  REFRESH_COOKIE_NAME: z.string().default("erp_refresh"),
  COOKIE_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  TOTP_KEK_HEX: z.string().length(64),
  ARGON2_MEMORY_KIB: z.coerce.number().int().positive().default(19456),
  ARGON2_TIME_COST: z.coerce.number().int().positive().default(2),
  ARGON2_PARALLELISM: z.coerce.number().int().positive().default(1),
  LOGIN_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  LOGIN_WINDOW_SECONDS: z.coerce.number().int().positive().default(900),
  BOOTSTRAP_ADMIN_EMAIL: z.string().email().default("admin@local.test"),
  BOOTSTRAP_ADMIN_PASSWORD: z.string().min(12).default("ChangeMe_admin1!"),
  BOOTSTRAP_ORG_SLUG: z.string().default("acme"),
  BOOTSTRAP_ORG_NAME: z.string().default("Acme"),
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;

export function loadApiEnv(env: NodeJS.ProcessEnv = process.env): ApiEnv {
  const parsed = apiEnvSchema.safeParse(env);
  if (!parsed.success) {
    const fields = Object.keys(parsed.error.flatten().fieldErrors);
    throw new Error(`Invalid environment configuration: ${fields.join(", ")}`);
  }
  return parsed.data;
}

export const webEnvSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url().default("http://localhost:3001"),
});

export type WebEnv = z.infer<typeof webEnvSchema>;
