"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cancelBooking, createSlots, deleteSlot, getHostSlots } from "./api";

export function useHostSlots(enabled: boolean) {
  return useQuery({
    queryKey: ["host-slots"],
    queryFn: getHostSlots,
    enabled,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 20_000,
  });
}

/** Every host mutation changes what guests see too, so both lists are invalidated. */
function useInvalidatingMutation<TVars, TData>(fn: (vars: TVars) => Promise<TData>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["slots"] });
      qc.invalidateQueries({ queryKey: ["host-slots"] });
    },
  });
}

export const useCreateSlots = () => useInvalidatingMutation(createSlots);
export const useDeleteSlot = () => useInvalidatingMutation(deleteSlot);
export const useCancelBooking = () => useInvalidatingMutation(cancelBooking);
