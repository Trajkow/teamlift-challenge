import { apiFetch } from "@/lib/api";
import type { CalendarStatus } from "@/lib/schemas/calendar";

export const getCalendarStatus = () => apiFetch<CalendarStatus>("/api/host/calendar");

export const disconnectCalendar = () => apiFetch<void>("/api/host/calendar", { method: "DELETE" });

/** Connecting is a full-page navigation to Google, so it can't send the host key header; it goes in the query. */
export const calendarConnectUrl = (hostKey: string | null) =>
  hostKey ? `/api/host/calendar/connect?hostKey=${encodeURIComponent(hostKey)}` : "/api/host/calendar/connect";
