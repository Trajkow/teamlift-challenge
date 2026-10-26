import {OAuth2Client} from 'google-auth-library';

export const OAUTH_PROVIDER = Symbol('OAUTH_PROVIDER');

export const CALENDAR_SCOPES = ['https://www.googleapis.com/auth/calendar.freebusy', 'openid', 'email'];

/** Google rejected the refresh token (revoked or expired): the host has to connect again. */
export class InvalidGrantError extends Error {
  constructor() {
    super('invalid_grant');
    this.name = 'InvalidGrantError';
  }
}

export type OAuthProvider = {
  /** True when the Google client id, secret and redirect URI are set. */
  available(): boolean;
  authUrl(state: string): string;
  /** Exchanges the authorization code. `refreshToken` is null when Google did not return one. */
  exchangeCode(code: string): Promise<{refreshToken: string | null; email: string}>;
  /** Mints an access token from the refresh token. Throws InvalidGrantError when it was rejected. */
  accessToken(refreshToken: string): Promise<{token: string; expiresAt: number}>;
  revoke(refreshToken: string): Promise<void>;
};

function isInvalidGrant(err: unknown): boolean {
  const e = err as {message?: unknown; response?: {data?: {error?: unknown}}} | null;
  return e?.response?.data?.error === 'invalid_grant' || (typeof e?.message === 'string' && e.message.includes('invalid_grant'));
}

/** The only code that talks to Google's OAuth endpoints. Tests replace it with a fake. */
export class GoogleOAuthProvider implements OAuthProvider {
  private config() {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
    const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim();
    return clientId && clientSecret && redirectUri ? {clientId, clientSecret, redirectUri} : null;
  }

  private client() {
    const c = this.config();
    if (!c) throw new Error('Google OAuth is not configured');
    return new OAuth2Client({clientId: c.clientId, clientSecret: c.clientSecret, redirectUri: c.redirectUri});
  }

  available(): boolean {
    return this.config() !== null;
  }

  authUrl(state: string): string {
    return this.client().generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: CALENDAR_SCOPES,
      state,
      include_granted_scopes: false,
    });
  }

  async exchangeCode(code: string) {
    const client = this.client();
    const {tokens} = await client.getToken(code);
    if (!tokens.id_token) throw new Error('Google returned no id token');
    const ticket = await client.verifyIdToken({idToken: tokens.id_token, audience: this.config()?.clientId});
    const email = ticket.getPayload()?.email;
    if (!email) throw new Error('id token has no email');
    return {refreshToken: tokens.refresh_token ?? null, email};
  }

  async accessToken(refreshToken: string) {
    const client = this.client();
    client.setCredentials({refresh_token: refreshToken});
    try {
      const {token} = await client.getAccessToken();
      if (!token) throw new Error('no access token');
      return {token, expiresAt: client.credentials.expiry_date ?? Date.now() + 50 * 60_000};
    } catch (err) {
      if (isInvalidGrant(err)) throw new InvalidGrantError();
      throw err;
    }
  }

  async revoke(refreshToken: string) {
    await this.client().revokeToken(refreshToken);
  }
}
