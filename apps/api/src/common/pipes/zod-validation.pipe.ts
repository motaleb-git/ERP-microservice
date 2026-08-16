import { PipeTransform, UnprocessableEntityException } from "@nestjs/common";
import type { ZodSchema } from "zod";
import { ErrorCodes } from "@erp/shared";

export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    const parsed = this.schema.safeParse(value);
    if (!parsed.success) {
      throw new UnprocessableEntityException({
        code: ErrorCodes.VALIDATION,
        message: "Request validation failed",
        details: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    }
    return parsed.data;
  }
}
