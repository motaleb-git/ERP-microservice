export class AppError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly httpStatus: number = 400,
    readonly details: unknown[] = [],
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const ErrorCodes = {
  VALIDATION: "COMMON.VALIDATION",
  UNAUTHORIZED: "COMMON.UNAUTHORIZED",
  FORBIDDEN: "COMMON.FORBIDDEN",
  NOT_FOUND: "COMMON.NOT_FOUND",
  CONFLICT: "COMMON.CONFLICT",
  VERSION_CONFLICT: "COMMON.VERSION_CONFLICT",
  INTERNAL: "COMMON.INTERNAL",
  DEPENDENCY_UNAVAILABLE: "COMMON.DEPENDENCY_UNAVAILABLE",
  INVALID_CREDENTIALS: "AUTH.INVALID_CREDENTIALS",
  LOCKED: "AUTH.LOCKED",
  TOTP_REQUIRED: "AUTH.TOTP_REQUIRED",
  TOTP_INVALID: "AUTH.TOTP_INVALID",
  SESSION_REVOKED: "AUTH.SESSION_REVOKED",
  PERIOD_CLOSED: "FIN.PERIOD_CLOSED",
  INSUFFICIENT_STOCK: "INV.INSUFFICIENT_STOCK",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
