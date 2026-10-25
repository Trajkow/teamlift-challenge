"use client";

import { CalendarPlusIcon, Ellipsis } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DayHeader } from "@/components/day-header";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toastError } from "@/lib/error-messages";
import { groupByDay } from "@/lib/group-by-day";
import type { HostSlot } from "@/lib/schemas/slots";
import { formatClock, formatDate, formatInstant, todayIn } from "@/lib/time";
import { useCancelBooking, useDeleteSlot } from "../hooks";

type Pending = { kind: "delete" | "cancel"; slot: HostSlot };

/** Upcoming slots by day as inset grouped lists; booked rows show who booked. */
export function HostSlotList({ slots, timeZone }: { slots: HostSlot[]; timeZone: string }) {
  const del = useDeleteSlot();
  const cancel = useCancelBooking();
  const [pending, setPending] = useState<Pending | null>(null);
  const today = todayIn(timeZone);
  const booked = slots.filter((s) => s.booking).length;

  async function confirm() {
    if (!pending) return;
    try {
      if (pending.kind === "delete") {
        await del.mutateAsync(pending.slot.id);
        toast.success("Slot deleted");
      } else if (pending.slot.booking) {
        await cancel.mutateAsync(pending.slot.booking.id);
        toast.success("Booking cancelled, the slot is available again");
      }
    } catch (err) {
      toastError(err);
    }
    setPending(null);
  }

  if (slots.length === 0) {
    return <EmptyState icon={CalendarPlusIcon} title="No upcoming slots" description="Publish a few above and they show up for guests right away." />;
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-subhead text-muted-foreground" aria-live="polite">
        {slots.length} upcoming, {booked} booked
      </p>
      {groupByDay(slots, timeZone).map((g) => (
        <section key={g.date} aria-label={formatDate(g.date, { weekday: "long", month: "long", day: "numeric" })}>
          <DayHeader date={g.date} today={today} />
          <ul className="divide-y divide-hairline overflow-hidden rounded-[22px] bg-card ring-1 ring-border">
            {g.items.map((s) => (
              <li key={s.id} className="flex items-start gap-3 px-4 py-3.5">
                <div className="w-[4.5rem] shrink-0 tabular-nums">
                  <p className="text-headline">{formatClock(s.startsAt, timeZone)}</p>
                  <p className="text-footnote text-muted-foreground">{s.durationMinutes} min</p>
                </div>
                <div className="min-w-0 flex-1">
                  {s.booking ? (
                    <>
                      <p className="truncate text-headline">{s.booking.name}</p>
                      <a href={`mailto:${s.booking.email}`} className="block truncate text-subhead text-accent-link underline-offset-2 hover:underline">
                        {s.booking.email}
                      </a>
                      {s.booking.note ? <p className="mt-1 text-subhead break-words text-muted-foreground">{s.booking.note}</p> : null}
                    </>
                  ) : (
                    <p className="pt-0.5 text-subhead text-muted-foreground">Open for booking</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <StatusBadge booked={s.isBooked} />
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${formatClock(s.startsAt, timeZone)} on ${formatDate(g.date)}`} />}
                    >
                      <Ellipsis aria-hidden />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" sideOffset={6} className="min-w-44">
                      <DropdownMenuItem variant="destructive" onClick={() => setPending({ kind: s.booking ? "cancel" : "delete", slot: s })}>
                        {s.booking ? "Cancel booking" : "Delete slot"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <ConfirmDialog
        open={!!pending}
        onOpenChange={(o) => !o && setPending(null)}
        title={pending?.kind === "cancel" ? "Cancel this booking?" : "Delete this slot?"}
        description={
          pending
            ? pending.kind === "cancel"
              ? `${pending.slot.booking?.name}'s booking on ${formatInstant(pending.slot.startsAt, timeZone)} will be cancelled and the slot becomes available again.`
              : `The slot on ${formatInstant(pending.slot.startsAt, timeZone)} will be removed.`
            : ""
        }
        confirmLabel={pending?.kind === "cancel" ? "Cancel booking" : "Delete slot"}
        destructive
        pending={del.isPending || cancel.isPending}
        onConfirm={confirm}
      />
    </div>
  );
}
