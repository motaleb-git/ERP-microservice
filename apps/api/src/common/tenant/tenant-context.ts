import { Injectable } from "@nestjs/common";
import { ClsService } from "nestjs-cls";
import { AppError, ErrorCodes } from "@erp/shared";
import type { AccessClaims } from "../../modules/auth/token.service";

type TenantStore = {
  organizationId?: string;
  userId?: string;
  isPlatformAdmin?: boolean;
  ip?: string;
  userAgent?: string;
};

@Injectable()
export class TenantContext {
  constructor(private readonly cls: ClsService) {}

  setFromClaims(claims: AccessClaims, ip: string, userAgent: string): void {
    this.cls.set("organizationId", claims.orgId ?? undefined);
    this.cls.set("userId", claims.sub);
    this.cls.set("isPlatformAdmin", claims.isPlatformAdmin);
    this.cls.set("ip", ip);
    this.cls.set("userAgent", userAgent);
  }

  userId(): string {
    const id = this.cls.get<string>("userId");
    if (!id) {
      throw new AppError(ErrorCodes.UNAUTHORIZED, "Not authenticated", 401);
    }
    return id;
  }

  organizationId(): string {
    const id = this.cls.get<string>("organizationId");
    if (!id) {
      throw new AppError(ErrorCodes.UNAUTHORIZED, "Organization context required", 401);
    }
    return id;
  }

  organizationIdOrNull(): string | null {
    return this.cls.get<string>("organizationId") ?? null;
  }

  isPlatformAdmin(): boolean {
    return this.cls.get<boolean>("isPlatformAdmin") === true;
  }

  actor(): { userId: string; organizationId: string | null; ip: string | null; userAgent: string | null } {
    return {
      userId: this.userId(),
      organizationId: this.organizationIdOrNull(),
      ip: this.cls.get<string>("ip") ?? null,
      userAgent: this.cls.get<string>("userAgent") ?? null,
    };
  }
}

export type { TenantStore };
