"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createBooking, getConfirmationMessage, getSlots } from "./api";

/** Open and booked future slots. Polls so another guest's booking shows up without a reload. */
export function useSlots() {
  return useQuery({
    queryKey: ["slots"],
    queryFn: getSlots,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 20_000,
  });
}

export function useBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { slotId: string; name: string; email: string; note?: string }) => {
      const { slotId, ...body } = input;
      return createBooking(slotId, body);
    },
    // Success or conflict, the slot list is stale afterwards.
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["slots"] });
      qc.invalidateQueries({ queryKey: ["host-slots"] });
    },
  });
}

const CONFIRMATION_POLL_MS = 3_000;
/** The backend gives up on the AI after about 40 s and answers with the template; stop polling a bit after that. */
export const CONFIRMATION_MAX_POLLS = 20;

/** The booking's confirmation message. Polls while the AI is still writing it, then stops. */
export function useConfirmationMessage(bookingId: string) {
  const qc = useQueryClient();
  const queryKey = ["confirmation", bookingId];
  const query = useQuery({
    queryKey,
    queryFn: () => getConfirmationMessage(bookingId),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchInterval: (query) =>
      query.state.data?.status === "pending" && query.state.dataUpdateCount < CONFIRMATION_MAX_POLLS
        ? CONFIRMATION_POLL_MS
        : false,
  });
  return { ...query, polls: qc.getQueryState(queryKey)?.dataUpdateCount ?? 0 };
}
