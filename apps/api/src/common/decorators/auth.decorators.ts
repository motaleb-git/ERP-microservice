import { SetMetadata } from "@nestjs/common";
import type { PermissionCode } from "@erp/shared";

export const IS_PUBLIC = "isPublic";
export const Public = () => SetMetadata(IS_PUBLIC, true);

export const REQUIRED_PERMISSION = "requiredPermission";
export const RequirePermission = (permission: PermissionCode) =>
  SetMetadata(REQUIRED_PERMISSION, permission);
