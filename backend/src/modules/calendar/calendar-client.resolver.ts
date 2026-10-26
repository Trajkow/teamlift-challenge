import {Inject, Injectable, Logger, Optional} from '@nestjs/common';
import {PrismaService} from '../../prisma/prisma.service.js';
import {CALENDAR_CLIENT, type CalendarClient, type CalendarSource} from './calendar.types.js';
import {OAUTH_PROVIDER, type OAuthProvider} from './oauth.provider.js';
import {OAuthCalendarClient} from './oauth-calendar.client.js';
import {decrypt, parseTokenKey} from './token-crypto.js';

/**
 * Picks the calendar client per request: the host's OAuth connection first, then the service account from env,
 * then none. A connection that needs reconnecting resolves to no client (fail open) and does not fall back, so the
 * host page can ask for a reconnect.
 */
@Injectable()
export class CalendarClientResolver {
  private readonly logger = new Logger(CalendarClientResolver.name);
  private cached: {fingerprint: string; client: OAuthCalendarClient} | null = null;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(OAUTH_PROVIDER) private readonly provider: OAuthProvider,
    @Optional() @Inject(CALENDAR_CLIENT) private readonly serviceAccount?: CalendarClient | null,
  ) {}

  hasServiceAccount(): boolean {
    return !!this.serviceAccount;
  }

  async resolve(): Promise<CalendarSource> {
    const fallback: CalendarSource = this.serviceAccount
      ? {client: this.serviceAccount, source: 'service_account'}
      : {client: null, source: null};
    try {
      const row = await this.prisma.calendarConnection.findUnique({where: {id: 'host'}});
      if (!row) {
        this.cached = null;
        return fallback;
      }
      if (row.needsReconnect) return {client: null, source: 'oauth'};
      const fingerprint = `${row.connectedAt.toISOString()}|${row.refreshTokenEncrypted}`;
      if (this.cached?.fingerprint === fingerprint) return {client: this.cached.client, source: 'oauth'};
      const key = parseTokenKey(process.env.CALENDAR_TOKEN_KEY);
      if (!key) return {client: null, source: 'oauth'};
      let refreshToken: string;
      try {
        refreshToken = decrypt(row.refreshTokenEncrypted, key);
      } catch {
        this.logger.warn('Stored calendar token could not be decrypted; the host has to reconnect');
        await this.markNeedsReconnect();
        return {client: null, source: 'oauth'};
      }
      const client = new OAuthCalendarClient(this.provider, refreshToken, () => this.markNeedsReconnect());
      this.cached = {fingerprint, client};
      return {client, source: 'oauth'};
    } catch (err) {
      this.logger.warn(`Calendar connection lookup failed (${err instanceof Error ? err.name : 'unknown error'})`);
      return fallback;
    }
  }

  forget() {
    this.cached = null;
  }

  async markNeedsReconnect() {
    this.cached = null;
    this.logger.warn('Google rejected the stored calendar token; the host has to reconnect');
    await this.prisma.calendarConnection
      .updateMany({where: {id: 'host'}, data: {needsReconnect: true}})
      .catch(() => undefined);
  }
}
