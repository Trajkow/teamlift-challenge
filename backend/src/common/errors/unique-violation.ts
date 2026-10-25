/** True for a Prisma P2002 or a raw pg 23505 unique violation. */
export function isUniqueViolation(err: unknown): boolean {
  const code = (err as {code?: unknown} | null)?.code;
  return code === 'P2002' || code === '23505';
}
