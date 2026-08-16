import { Inject, Injectable } from "@nestjs/common";
import jwt from "jsonwebtoken";
import type { ApiEnv } from "@erp/config";
import { AppError, ErrorCodes } from "@erp/shared";
import { APP_CONFIG } from "../../infrastructure/config/app-config.module";

export type AccessClaims = {
  sub: string;
  orgId: string | null;
  pv: number;
  typ: "access";
  isPlatformAdmin: boolean;
};

export type PreAuthClaims = {
  sub: string;
  typ: "preauth";
  amr: string[];
};

@Injectable()
export class TokenService {
  constructor(@Inject(APP_CONFIG) private readonly env: ApiEnv) {}

  signAccess(claims: Omit<AccessClaims, "typ">): string {
    return jwt.sign(
      { ...claims, typ: "access" },
      this.env.JWT_ACCESS_SECRET,
      { expiresIn: this.env.JWT_ACCESS_TTL_SECONDS },
    );
  }

  signPreAuth(userId: string): string {
    return jwt.sign(
      { sub: userId, typ: "preauth", amr: ["pwd"] },
      this.env.JWT_ACCESS_SECRET,
      { expiresIn: 300 },
    );
  }

  verifyAccess(token: string): AccessClaims {
    const decoded = this.verify(token);
    if (decoded.typ !== "access") {
      throw new AppError(ErrorCodes.UNAUTHORIZED, "Invalid access token", 401);
    }
    return decoded as AccessClaims;
  }

  verifyPreAuth(token: string): PreAuthClaims {
    const decoded = this.verify(token);
    if (decoded.typ !== "preauth") {
      throw new AppError(ErrorCodes.UNAUTHORIZED, "Invalid pre-auth token", 401);
    }
    return decoded as PreAuthClaims;
  }

  private verify(token: string): jwt.JwtPayload & { typ?: string } {
    try {
      const payload = jwt.verify(token, this.env.JWT_ACCESS_SECRET);
      if (typeof payload === "string") {
        throw new AppError(ErrorCodes.UNAUTHORIZED, "Invalid token", 401);
      }
      return payload;
    } catch {
      throw new AppError(ErrorCodes.UNAUTHORIZED, "Invalid token", 401);
    }
  }
}
