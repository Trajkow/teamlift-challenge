/** Use-case error with a stable machine-readable code, e.g. `SLOT_UNAVAILABLE`. */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'AppError';
  }
}
