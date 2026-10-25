"use client";

import { useQuery } from "@tanstack/react-query";
import { getConfig } from "./api";

export function useAppConfig() {
  return useQuery({ queryKey: ["config"], queryFn: getConfig, staleTime: 5 * 60_000 });
}
