export type ApiMeta = {
  correlationId: string;
  nextCursor?: string;
  hasMore?: boolean;
};

export type ApiSuccess<T> = {
  data: T;
  meta: ApiMeta;
};

export type ApiErrorBody = {
  code: string;
  message: string;
  details: unknown[];
  correlationId: string;
};

export type ApiFailure = {
  error: ApiErrorBody;
};

export type HealthStatus = {
  status: "ok";
  service: "erp-api" | "erp-worker";
};

export type ReadinessCheck = "up" | "down";

export type ReadinessStatus = {
  status: "ok" | "degraded";
  checks: {
    postgres: ReadinessCheck;
    redisCache: ReadinessCheck;
    redisQueue: ReadinessCheck;
    rabbitmq: ReadinessCheck;
  };
};
