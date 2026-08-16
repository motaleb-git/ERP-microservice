import { Injectable } from "@nestjs/common";
import { ClsService } from "nestjs-cls";
import { newId } from "@erp/shared";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import { redactAudit } from "../crypto";

@Injectable()
export class AuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}

  async record(input: {
    action: string;
    module: string;
    entity: string;
    entityId?: string | null;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
    organizationId?: string | null;
    userId?: string | null;
    ip?: string | null;
    userAgent?: string | null;
  }): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        id: newId(),
        organizationId: input.organizationId ?? this.cls.get("organizationId") ?? null,
        userId: input.userId ?? this.cls.get("userId") ?? null,
        action: input.action,
        module: input.module,
        entity: input.entity,
        entityId: input.entityId ?? null,
        before: input.before ? redactAudit(input.before) : undefined,
        after: input.after ? redactAudit(input.after) : undefined,
        ip: input.ip ?? this.cls.get("ip") ?? null,
        userAgent: input.userAgent ?? this.cls.get("userAgent") ?? null,
        correlationId: this.cls.getId() ?? newId(),
      },
    });
  }
}
