"use client";

import { CalendarPlusIcon, CircleCheck, Sparkles } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { buildIcs, downloadIcs } from "@/lib/ics";
import type { BookingConfirmation } from "@/lib/schemas/slots";
import { formatClock, formatInstant } from "@/lib/time";
import { useConfirmationMessage } from "../hooks";

/** Shown in place of the slot list after a booking. */
export function BookingSuccess({
  booking,
  timeZone,
  hostName,
  onBookAnother,
}: {
  booking: BookingConfirmation;
  timeZone: string;
  hostName: string;
  onBookAnother: () => void;
}) {
  const { slot } = booking;
  const { mutate, data, isError } = useConfirmationMessage();
  const requested = useRef(false);

  useEffect(() => {
    if (requested.current) return;
    requested.current = true;
    mutate(booking.id);
  }, [booking.id, mutate]);

  function addToCalendar() {
    downloadIcs(
      "booking.ics",
      buildIcs({
        uid: booking.id,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        summary: `Chat with ${hostName}`,
        description: `Booked by ${booking.name}.`,
      }),
    );
  }

  return (
    <section aria-live="polite" className="flex flex-col gap-4 rounded-[22px] bg-success-bg p-5 ring-1 ring-border sm:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <CircleCheck className="size-7 text-success" aria-hidden />
        <h2 className="text-title">You&apos;re booked</h2>
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-headline">
          {formatInstant(slot.startsAt, timeZone, { weekday: "long", month: "long", day: "numeric" })}, {formatClock(slot.startsAt, timeZone)} to{" "}
          {formatClock(slot.endsAt, timeZone)}
        </p>
        <p className="text-foreground/80">
          {booking.name}, you have {slot.durationMinutes} minutes with {hostName}. All times in {timeZone}.
        </p>
      </div>
      {isError ? null : data ? (
        <figure className="flex flex-col gap-2 rounded-2xl bg-card p-4 ring-1 ring-border">
          <blockquote className="text-body">{data.message}</blockquote>
          {data.source === "ai" ? (
            <figcaption className="flex items-center gap-1 text-footnote text-muted-foreground">
              <Sparkles className="size-3" aria-hidden />
              Written by AI
            </figcaption>
          ) : null}
        </figure>
      ) : (
        <div className="flex flex-col gap-2 rounded-2xl bg-card p-4 ring-1 ring-border" role="status" aria-label="Writing your confirmation">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button variant="glass" onClick={addToCalendar}>
          <CalendarPlusIcon aria-hidden />
          Add to calendar
        </Button>
        <Button onClick={onBookAnother}>Book another</Button>
      </div>
    </section>
  );
}
