import type {CalendarClient, Interval} from './calendar.types.js';
import {fetchFreeBusy} from './google-calendar.client.js';
import {InvalidGrantError, type OAuthProvider} from './oauth.provider.js';

const EXPIRY_MARGIN_MS = 60_000;

/** Free/busy for the connected account's `primary` calendar, using the stored refresh token. */
export class OAuthCalendarClient implements CalendarClient {
  private access: {token: string; expiresAt: number} | null = null;

  constructor(
    private readonly provider: OAuthProvider,
    private readonly refreshToken: string,
    /** Called when Google rejects the refresh token. */
    private readonly onInvalidGrant: () => void | Promise<void>,
  ) {}

  async freeBusy(from: Date, to: Date, signal: AbortSignal): Promise<Interval[]> {
    const token = await this.token();
    return fetchFreeBusy(token, 'primary', from, to, signal);
  }

  private async token(): Promise<string> {
    if (this.access && this.access.expiresAt - EXPIRY_MARGIN_MS > Date.now()) return this.access.token;
    try {
      this.access = await this.provider.accessToken(this.refreshToken);
      return this.access.token;
    } catch (err) {
      if (err instanceof InvalidGrantError) await this.onInvalidGrant();
      throw err;
    }
  }
}
