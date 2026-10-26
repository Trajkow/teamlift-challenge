"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { disconnectCalendar, getCalendarStatus } from "./api";

/** Everything that depends on the calendar: the config flag, the status card and both slot lists (Busy marks). */
export function useRefreshCalendarData() {
  const qc = useQueryClient();
  return () => {
    for (const key of ["calendar", "config", "slots", "host-slots"]) qc.invalidateQueries({ queryKey: [key] });
  };
}

export function useCalendarStatus(enabled: boolean) {
  return useQuery({ queryKey: ["calendar"], queryFn: getCalendarStatus, enabled, staleTime: 0, refetchOnWindowFocus: true });
}

export function useDisconnectCalendar() {
  const refresh = useRefreshCalendarData();
  return useMutation({ mutationFn: disconnectCalendar, onSettled: refresh });
}
