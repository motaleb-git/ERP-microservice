const SCALE = 4n;
const FACTOR = 10n ** SCALE;

export class Money {
  private constructor(
    readonly currency: string,
    private readonly minor: bigint,
  ) {
    if (!/^[A-Z]{3}$/.test(currency)) {
      throw new Error("currency must be ISO 4217");
    }
  }

  static of(currency: string, amount: string | number): Money {
    const normalized = typeof amount === "number" ? amount.toFixed(4) : amount;
    const [whole, fraction = ""] = normalized.split(".");
    const frac = (fraction + "0000").slice(0, 4);
    const sign = whole.startsWith("-") ? -1n : 1n;
    const absWhole = whole.replace("-", "");
    const minor = sign * (BigInt(absWhole) * FACTOR + BigInt(frac));
    return new Money(currency, minor);
  }

  static zero(currency: string): Money {
    return new Money(currency, 0n);
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.currency, this.minor + other.minor);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.currency, this.minor - other.minor);
  }

  isZero(): boolean {
    return this.minor === 0n;
  }

  isNegative(): boolean {
    return this.minor < 0n;
  }

  toString(): string {
    const sign = this.minor < 0n ? "-" : "";
    const abs = this.minor < 0n ? -this.minor : this.minor;
    const whole = abs / FACTOR;
    const frac = (abs % FACTOR).toString().padStart(4, "0");
    return `${sign}${whole.toString()}.${frac}`;
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new Error(`currency mismatch: ${this.currency} vs ${other.currency}`);
    }
  }
}
