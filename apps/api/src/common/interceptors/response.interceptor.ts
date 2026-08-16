import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { Observable, map } from "rxjs";

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request & { id?: string }>();
    const response = http.getResponse<Response>();
    const path = request.path ?? "";
    if (path === "/metrics" || path.startsWith("/api/docs")) {
      return next.handle();
    }

    const correlationId =
      (request.headers["x-correlation-id"] as string | undefined) ??
      request.id ??
      "unknown";
    response.setHeader("x-correlation-id", correlationId);

    return next.handle().pipe(
      map((body) => {
        if (body && typeof body === "object" && ("data" in body || "error" in body)) {
          return body;
        }
        return {
          data: body,
          meta: { correlationId },
        };
      }),
    );
  }
}
