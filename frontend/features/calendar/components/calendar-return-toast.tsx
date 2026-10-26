"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";
import { useRefreshCalendarData } from "../hooks";

/** Reads `?calendar=connected|error` after the Google round trip, shows a toast and strips the parameter. */
export function CalendarReturnToast() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const refresh = useRefreshCalendarData();
  const result = params.get("calendar");

  useEffect(() => {
    if (result !== "connected" && result !== "error") return;
    if (result === "connected") {
      toast.success("Google Calendar connected");
      refresh();
    } else {
      toast.error("Could not connect Google Calendar. Please try again.");
    }
    router.replace(pathname);
    // `refresh` is recreated each render; the effect should run once per returned result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  return null;
}
