/** Collect every string-valued code-ish field reachable through cause/meta, to see through Prisma's wrapping. */
export function collectCodes(err: unknown, out: string[] = [], depth = 0): string[] {
  if (!err || typeof err !== 'object' || depth > 6) return out;
  const o = err as Record<string, unknown>;
  for (const key of ['code', 'originalCode', 'sqlState']) {
    if (typeof o[key] === 'string') out.push(o[key] as string);
  }
  for (const key of ['cause', 'meta', 'driverAdapterError', 'originalError']) {
    collectCodes(o[key], out, depth + 1);
  }
  return out;
}

/** deadlock_detected, serialization_failure, and Prisma's "transaction failed due to a write conflict or a deadlock". */
const TRANSIENT_CODES = new Set(['40P01', '40001', 'P2034']);

/** True when the database aborted the transaction for a reason that a retry can resolve. */
export function isTransientTxError(err: unknown): boolean {
  return collectCodes(err).some((c) => TRANSIENT_CODES.has(c));
}
