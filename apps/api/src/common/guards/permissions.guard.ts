import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AppError, ErrorCodes, type PermissionCode } from "@erp/shared";
import { REQUIRED_PERMISSION } from "../decorators/auth.decorators";
import { PermissionService } from "../../modules/identity/permission.service";
import { TenantContext } from "../tenant/tenant-context";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissions: PermissionService,
    private readonly tenant: TenantContext,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<PermissionCode | undefined>(REQUIRED_PERMISSION, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) {
      return true;
    }
    if (this.tenant.isPlatformAdmin()) {
      return true;
    }
    const request = context.switchToHttp().getRequest<{ user?: { pv?: number } }>();
    const allowed = await this.permissions.hasPermission(
      this.tenant.userId(),
      this.tenant.organizationId(),
      required,
      request.user?.pv,
    );
    if (!allowed) {
      throw new AppError(ErrorCodes.FORBIDDEN, "Missing permission", 403);
    }
    return true;
  }
}
