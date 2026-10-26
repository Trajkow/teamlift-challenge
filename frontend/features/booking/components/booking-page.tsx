"use client";

import { CalendarX2Icon } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/page-skeleton";
import { Button } from "@/components/ui/button";
import { useAppConfig } from "@/features/config/hooks";
import type { BookingConfirmation } from "@/lib/schemas/slots";
import { formatClock, formatDate, zonedParts } from "@/lib/time";
import { useSlots } from "../hooks";
import { BookingDialog } from "./booking-dialog";
import { BookingSuccess } from "./booking-success";
import { SlotList } from "./slot-list";

/** Guest page: pick an open slot, then book it from the floating bar. */
export function BookingPage() {
  const config = useAppConfig();
  const slots = useSlots();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [booked, setBooked] = useState<BookingConfirmation | null>(null);
  const [showBooked, setShowBooked] = useState(true);

  const timeZone = config.data?.timeZone;
  const hostName = config.data?.hostName ?? "the host";
  // A selection only counts while the slot is still open (a refetch may have flipped it to booked).
  const selected = slots.data?.find((s) => s.id === selectedId && !s.isBooked && !s.isBusy) ?? null;
  const hasVisible = slots.data?.some((s) => !s.isBooked || s.isBusy) ?? false;
  const open = slots.data?.filter((s) => !s.isBooked && !s.isBusy).length ?? 0;

  const header = (
    <PageHeader
      title="Book a time"
      description={timeZone ? `Pick a slot with ${hostName}. All times in ${timeZone} time.` : "Pick a slot and book it in seconds."}
    />
  );

  if (config.isError || slots.isError) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        {header}
        <ErrorState
          error={config.error ?? slots.error}
          title="Could not load the slots"
          onRetry={() => {
            if (config.isError) config.refetch();
            if (slots.isError) slots.refetch();
          }}
        />
      </div>
    );
  }
  if (!timeZone || !slots.data) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageSkeleton />
      </div>
    );
  }

  if (booked) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        {header}
        <BookingSuccess
          booking={booked}
          timeZone={timeZone}
          hostName={hostName}
          onBookAnother={() => {
            setBooked(null);
            setSelectedId(null);
          }}
        />
      </div>
    );
  }

  const dayLabel = selected
    ? `${formatDate(zonedParts(selected.startsAt, timeZone).date, { weekday: "short", month: "short", day: "numeric" })} · ${formatClock(selected.startsAt, timeZone)}`
    : "";

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      {header}

      {slots.data.length === 0 ? (
        <EmptyState icon={CalendarX2Icon} title="No open slots right now" description="Check back soon." />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-subhead text-muted-foreground" aria-live="polite">
              {open === 0 ? "Nothing available right now" : `${open} available`}
            </p>
            <Button variant={showBooked ? "default" : "glass"} size="sm" aria-pressed={showBooked} onClick={() => setShowBooked((v) => !v)} className="max-md:min-h-11">
              Show booked
            </Button>
          </div>
          {!showBooked && !hasVisible ? (
            <EmptyState icon={CalendarX2Icon} compact title="No open slots right now" description="Check back soon, or show booked slots." />
          ) : (
            <SlotList
              slots={slots.data}
              timeZone={timeZone}
              selectedId={selected?.id ?? null}
              onSelect={(s) => {
                setSelectedId(s.id);
                setDialogOpen(false);
              }}
              showBooked={showBooked}
            />
          )}
        </>
      )}

      {selected ? (
        <>
          {/* Keeps the last content clear of the floating bar. */}
          <div aria-hidden className="h-20" />
          <div className="glass fixed inset-x-3 bottom-[var(--float-bottom-tabbar)] z-40 mx-auto flex max-w-2xl items-center gap-3 rounded-full py-2 pr-2 pl-5">
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-headline">{dayLabel}</span>
              <span className="truncate text-footnote text-foreground/80">{selected.durationMinutes} min with {hostName}</span>
            </div>
            <Button size="lg" onClick={() => setDialogOpen(true)}>
              Book
            </Button>
          </div>
        </>
      ) : null}

      {selected && dialogOpen ? (
        <BookingDialog
          slot={selected}
          timeZone={timeZone}
          onClose={() => setDialogOpen(false)}
          onBooked={(b) => {
            setDialogOpen(false);
            setSelectedId(null);
            setBooked(b);
          }}
          onSlotGone={() => {
            setDialogOpen(false);
            setSelectedId(null);
          }}
        />
      ) : null}
    </div>
  );
}
