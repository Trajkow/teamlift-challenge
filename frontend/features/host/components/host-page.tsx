"use client";

import { Suspense, useState } from "react";
import { ErrorState } from "@/components/error-state";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/page-skeleton";
import { CalendarCard } from "@/features/calendar/components/calendar-card";
import { CalendarReturnToast } from "@/features/calendar/components/calendar-return-toast";
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

  const header = (
    <PageHeader title="Host" description={config.data ? `Publish slots and see who booked them. All times in ${config.data.timeZone} time.` : "Publish slots and see who booked them."} />
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
      <Suspense fallback={null}>
        <CalendarReturnToast />
      </Suspense>
      <CalendarCard hostKey={key} />
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
