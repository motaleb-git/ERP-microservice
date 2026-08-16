import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function generateTotpSecret(): Buffer {
  return randomBytes(20);
}

export function encodeBase32(bytes: Buffer): string {
  let bits = "";
  for (const byte of bytes) {
    bits += byte.toString(2).padStart(8, "0");
  }
  const padded = bits.padEnd(Math.ceil(bits.length / 5) * 5, "0");
  let output = "";
  for (let i = 0; i < padded.length; i += 5) {
    output += BASE32[Number.parseInt(padded.slice(i, i + 5), 2)];
  }
  return output;
}

export function decodeBase32(input: string): Buffer {
  const cleaned = input.toUpperCase().replace(/=+$/g, "");
  let bits = "";
  for (const char of cleaned) {
    const index = BASE32.indexOf(char);
    if (index < 0) {
      throw new Error("invalid base32");
    }
    bits += index.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(Number.parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function hotp(secret: Buffer, counter: number): string {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", secret).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return code.toString().padStart(6, "0");
}

export function verifyTotp(secret: Buffer, token: string, window = 1): boolean {
  if (!/^\d{6}$/.test(token)) {
    return false;
  }
  const now = Math.floor(Date.now() / 30_000);
  const presented = Buffer.from(token);
  for (let w = -window; w <= window; w += 1) {
    const generated = Buffer.from(hotp(secret, now + w));
    if (generated.length === presented.length && timingSafeEqual(generated, presented)) {
      return true;
    }
  }
  return false;
}

export function otpauthUrl(email: string, secretBase32: string, issuer = "ERP"): string {
  const label = encodeURIComponent(`${issuer}:${email}`);
  return `otpauth://totp/${label}?secret=${secretBase32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}
