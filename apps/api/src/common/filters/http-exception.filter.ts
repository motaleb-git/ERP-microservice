import { AppError, ErrorCodes } from "@erp/shared";
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Request, Response } from "express";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { id?: string }>();
    const correlationId =
      (request.headers["x-correlation-id"] as string | undefined) ??
      request.id ??
      "unknown";

    if (exception instanceof AppError) {
      response.status(exception.httpStatus).json({
        error: {
          code: exception.code,
          message: exception.message,
          details: exception.details,
          correlationId,
        },
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      const message =
        typeof payload === "string"
          ? payload
          : typeof payload === "object" && payload !== null && "message" in payload
            ? String((payload as { message: unknown }).message)
            : exception.message;
      response.status(status).json({
        error: {
          code: status === HttpStatus.NOT_FOUND ? ErrorCodes.NOT_FOUND : ErrorCodes.VALIDATION,
          message,
          details: [],
          correlationId,
        },
      });
      return;
    }

    this.logger.error("unhandled_error", exception instanceof Error ? exception.stack : undefined);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: {
        code: ErrorCodes.INTERNAL,
        message: "An unexpected error occurred",
        details: [],
        correlationId,
      },
    });
  }
}
