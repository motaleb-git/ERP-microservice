import { Inject, Injectable } from "@nestjs/common";
import * as argon2 from "argon2";
import type { ApiEnv } from "@erp/config";
import { APP_CONFIG } from "../../infrastructure/config/app-config.module";

@Injectable()
export class PasswordService {
  private dummyHash: string | undefined;

  constructor(@Inject(APP_CONFIG) private readonly env: ApiEnv) {}

  async hash(password: string): Promise<string> {
    return argon2.hash(password, this.options());
  }

  async verify(hash: string, password: string): Promise<boolean> {
    return argon2.verify(hash, password);
  }

  async dummyVerify(password: string): Promise<void> {
    this.dummyHash ??= await this.hash("timing-safe-dummy-password");
    await argon2.verify(this.dummyHash, password).catch(() => undefined);
  }

  private options(): argon2.Options {
    return {
      type: argon2.argon2id,
      memoryCost: this.env.ARGON2_MEMORY_KIB,
      timeCost: this.env.ARGON2_TIME_COST,
      parallelism: this.env.ARGON2_PARALLELISM,
    };
  }
}
