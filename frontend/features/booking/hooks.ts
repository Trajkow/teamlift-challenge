"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createBooking, getSlots } from "./api";

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
