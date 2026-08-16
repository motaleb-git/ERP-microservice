export type CursorPayload = {
  createdAt: string;
  id: string;
};

export function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeCursor(cursor: string): CursorPayload {
  const raw = Buffer.from(cursor, "base64url").toString("utf8");
  const parsed: unknown = JSON.parse(raw);
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("createdAt" in parsed) ||
    !("id" in parsed) ||
    typeof (parsed as CursorPayload).createdAt !== "string" ||
    typeof (parsed as CursorPayload).id !== "string"
  ) {
    throw new Error("invalid cursor");
  }
  return parsed as CursorPayload;
}
