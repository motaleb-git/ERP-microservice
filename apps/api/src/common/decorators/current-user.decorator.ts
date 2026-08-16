import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { AccessClaims } from "../../modules/auth/token.service";

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AccessClaims => {
    const request = ctx.switchToHttp().getRequest<{ user: AccessClaims }>();
    return request.user;
  },
);
