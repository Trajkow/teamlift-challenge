import {Inject, Injectable, Logger} from '@nestjs/common';
import {AppError} from '../../common/errors/app-error.js';
import {PrismaService} from '../../prisma/prisma.service.js';
import {CalendarBusyService} from './calendar-busy.service.js';
import {CalendarClientResolver} from './calendar-client.resolver.js';
import type {CalendarSourceName} from './calendar.types.js';
import {OAUTH_PROVIDER, type OAuthProvider} from './oauth.provider.js';
import {OAuthStateStore} from './oauth-state.store.js';
import {decrypt, encrypt, parseTokenKey} from './token-crypto.js';

export type CalendarStatus = {
  connected: boolean;
  source: CalendarSourceName | null;
  email: string | null;
  needsReconnect: boolean;
  oauthAvailable: boolean;
};

@Injectable()
export class CalendarConnectionService {
  private readonly logger = new Logger(CalendarConnectionService.name);
  private readonly states = new OAuthStateStore();

  constructor(
    private readonly prisma: PrismaService,
    private readonly busy: CalendarBusyService,
    private readonly resolver: CalendarClientResolver,
    @Inject(OAUTH_PROVIDER) private readonly provider: OAuthProvider,
  ) {}

  /** OAuth needs the Google client settings and a valid token key. */
  oauthAvailable(): boolean {
    return this.provider.available() && parseTokenKey(process.env.CALENDAR_TOKEN_KEY) !== null;
  }

  async status(): Promise<CalendarStatus> {
    const oauthAvailable = this.oauthAvailable();
    const row = await this.prisma.calendarConnection.findUnique({where: {id: 'host'}});
    if (row) {
      return {connected: true, source: 'oauth', email: row.email, needsReconnect: row.needsReconnect, oauthAvailable};
    }
    const serviceAccount = this.resolver.hasServiceAccount();
    return {
      connected: serviceAccount,
      source: serviceAccount ? 'service_account' : null,
      email: null,
      needsReconnect: false,
      oauthAvailable,
    };
  }

  /** The Google consent URL with a fresh single-use `state`. */
  startConnect(): string {
    if (!this.oauthAvailable()) throw new AppError(404, 'NOT_FOUND', 'Google Calendar sign-in is not set up');
    return this.provider.authUrl(this.states.issue());
  }

  /** Returns true on success. Never throws and never logs the code or tokens. */
  async completeConnect(code: string | undefined, state: string | undefined): Promise<boolean> {
    try {
      if (!this.states.consume(state) || !code) return false;
      const key = parseTokenKey(process.env.CALENDAR_TOKEN_KEY);
      if (!key || !this.provider.available()) return false;
      const {refreshToken, email} = await this.provider.exchangeCode(code);
      if (!refreshToken) {
        this.logger.warn('Google returned no refresh token; connect again and accept the consent screen');
        return false;
      }
      const refreshTokenEncrypted = encrypt(refreshToken, key);
      const data = {email, refreshTokenEncrypted, needsReconnect: false, connectedAt: new Date()};
      await this.prisma.calendarConnection.upsert({where: {id: 'host'}, create: {id: 'host', ...data}, update: data});
      this.changed();
      return true;
    } catch (err) {
      this.logger.warn(`Calendar connect failed (${err instanceof Error ? err.name : 'unknown error'})`);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    const row = await this.prisma.calendarConnection.findUnique({where: {id: 'host'}});
    if (!row) return;
    await this.prisma.calendarConnection.deleteMany({where: {id: 'host'}});
    this.changed();
    // Best effort: the connection is gone locally even if Google cannot be reached or the token is already dead.
    try {
      const key = parseTokenKey(process.env.CALENDAR_TOKEN_KEY);
      if (key && this.provider.available()) await this.provider.revoke(decrypt(row.refreshTokenEncrypted, key));
    } catch (err) {
      this.logger.warn(`Could not revoke the Google token (${err instanceof Error ? err.name : 'unknown error'})`);
    }
  }

  private changed() {
    this.resolver.forget();
    this.busy.clearCache();
  }
}
