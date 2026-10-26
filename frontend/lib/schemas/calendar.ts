/** Mirrors `GET /api/host/calendar`. */
export type CalendarStatus = {
  connected: boolean;
  source: "oauth" | "service_account" | null;
  email: string | null;
  needsReconnect: boolean;
  oauthAvailable: boolean;
};
