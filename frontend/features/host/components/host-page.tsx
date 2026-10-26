"use client";

import { CalendarCheck2Icon } from "lucide-react";
import { useState } from "react";
import { ErrorState } from "@/components/error-state";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/page-skeleton";
import { useAppConfig } from "@/features/config/hooks";
import { isApiError } from "@/lib/error-messages";
import { getHostKey, setHostKey } from "@/lib/host-key";
import { useHostSlots } from "../hooks";
import { CreateSlotsForm } from "./create-slots-form";
import { HostKeyCard } from "./host-key-card";
import { HostSlotList } from "./host-slot-list";

/** Host page: publish slots, see who booked them, cancel or delete. */
export function HostPage() {
  const config = useAppConfig();
  const [key, setKey] = useState<string | null>(() => getHostKey());
  const needsKey = !!config.data?.hostKeyRequired && !key;
  const slots = useHostSlots(!!config.data && !needsKey);
  const keyRejected = isApiError(slots.error, "HOST_KEY_REQUIRED");

  const calendarPill = config.data ? (
    <span
      className={`inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-footnote font-medium ${config.data.calendarConnected ? "bg-success-bg text-success" : "bg-muted text-muted-foreground"}`}
    >
      <CalendarCheck2Icon className="size-3.5" aria-hidden />
      {config.data.calendarConnected ? "Google Calendar connected" : "Calendar not connected"}
    </span>
  ) : null;
  const header = (
    <div className="flex flex-col gap-3">
      <PageHeader title="Host" description={config.data ? `Publish slots and see who booked them. All times in ${config.data.timeZone} time.` : "Publish slots and see who booked them."} />
      {calendarPill}
    </div>
  );

  if (config.isError) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        {header}
        <ErrorState error={config.error} title="Could not load the app" onRetry={() => config.refetch()} />
      </div>
    );
  }
  if (!config.data) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageSkeleton />
      </div>
    );
  }

  if (needsKey || keyRejected) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        {header}
        <HostKeyCard
          invalid={keyRejected}
          onSubmit={(k) => {
            setHostKey(k);
            setKey(k);
            slots.refetch();
          }}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      {header}
      <CreateSlotsForm timeZone={config.data.timeZone} />
      {slots.isError ? (
        <ErrorState error={slots.error} title="Could not load your slots" onRetry={() => slots.refetch()} />
      ) : !slots.data ? (
        <PageSkeleton />
      ) : (
        <HostSlotList slots={slots.data} timeZone={config.data.timeZone} />
      )}
    </div>
  );
}
