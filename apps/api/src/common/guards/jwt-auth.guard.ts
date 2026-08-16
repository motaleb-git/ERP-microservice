import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AppError, ErrorCodes } from "@erp/shared";
import { IS_PUBLIC } from "../decorators/auth.decorators";
import { TenantContext } from "../tenant/tenant-context";
import { TokenService } from "../../modules/auth/token.service";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    private readonly tenant: TenantContext,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      ip?: string;
      socket?: { remoteAddress?: string };
      user?: unknown;
    }>();
    const header = request.headers.authorization;
    const value = Array.isArray(header) ? header[0] : header;
    if (!value?.startsWith("Bearer ")) {
      throw new AppError(ErrorCodes.UNAUTHORIZED, "Missing access token", 401);
    }
    const claims = this.tokens.verifyAccess(value.slice(7));
    const ip = request.ip ?? request.socket?.remoteAddress ?? "unknown";
    const userAgentHeader = request.headers["user-agent"];
    const userAgent = Array.isArray(userAgentHeader) ? userAgentHeader[0] : (userAgentHeader ?? "");
    this.tenant.setFromClaims(claims, ip, userAgent);
    request.user = claims;
    return true;
  }
}
