export function isRefreshReuse(session: {
  revokedAt: Date | null;
  replacedBySessionId: string | null;
}): boolean {
  return session.revokedAt !== null || session.replacedBySessionId !== null;
}
