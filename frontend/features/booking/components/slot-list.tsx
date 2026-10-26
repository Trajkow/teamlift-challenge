"use client";

import { groupByDay } from "@/lib/group-by-day";
import { DayHeader } from "@/components/day-header";
import { formatClock, formatDate, todayIn } from "@/lib/time";
import type { PublicSlot } from "@/lib/schemas/slots";
import { cn } from "@/lib/utils";

/** Future slots grouped by day. Available slots are buttons; booked ones are muted, struck through and disabled,
 *  and ones that clash with the host's calendar are muted and labelled Busy (always shown, never struck through). */
export function SlotList({
  slots,
  timeZone,
  selectedId,
  onSelect,
  showBooked,
}: {
  slots: PublicSlot[];
  timeZone: string;
  selectedId: string | null;
  onSelect: (slot: PublicSlot) => void;
  showBooked: boolean;
}) {
  const today = todayIn(timeZone);
  const groups = groupByDay(showBooked ? slots : slots.filter((s) => !s.isBooked), timeZone);

  return (
    <div className="flex flex-col gap-2">
      {groups.map((g) => {
        const open = g.items.filter((s) => !s.isBooked && !s.isBusy).length;
        const dayLabel = formatDate(g.date, { weekday: "long", month: "long", day: "numeric" });
        return (
          <section key={g.date} aria-label={dayLabel}>
            <DayHeader date={g.date} today={today} trailing={`${open} available`} />
            <div className="rounded-[22px] bg-card p-3 ring-1 ring-border sm:p-4">
              <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 sm:gap-3 lg:grid-cols-6">
                {g.items.map((s) => {
                  const time = formatClock(s.startsAt, timeZone);
                  if (s.isBooked) {
                    return (
                      <li key={s.id}>
                        <button
                          type="button"
                          disabled
                          aria-label={`${time} on ${dayLabel}, booked`}
                          className="flex h-11 w-full flex-col items-center justify-center rounded-full bg-muted text-muted-foreground opacity-70"
                        >
                          <span className="text-[0.9375rem] leading-none font-medium whitespace-nowrap tabular-nums line-through">{time}</span>
                          <span className="mt-0.5 text-[0.6875rem] leading-none">Booked</span>
                        </button>
                      </li>
                    );
                  }
                  if (s.isBusy) {
                    return (
                      <li key={s.id}>
                        <button
                          type="button"
                          disabled
                          aria-label={`${time} on ${dayLabel}, busy, the host has a calendar event`}
                          className="flex h-11 w-full flex-col items-center justify-center rounded-full bg-muted/60 text-muted-foreground ring-1 ring-border ring-inset"
                        >
                          <span className="text-[0.9375rem] leading-none font-medium whitespace-nowrap tabular-nums">{time}</span>
                          <span className="mt-0.5 text-[0.6875rem] leading-none">Busy</span>
                        </button>
                      </li>
                    );
                  }
                  const isSelected = s.id === selectedId;
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        aria-pressed={isSelected}
                        aria-label={`${time} on ${dayLabel}, available, ${s.durationMinutes} minutes`}
                        onClick={() => onSelect(s)}
                        className={cn(
                          "h-11 w-full rounded-full text-[0.9375rem] font-medium whitespace-nowrap tabular-nums outline-none transition-colors duration-200 ease-out focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring active:scale-[0.98] motion-reduce:active:scale-100",
                          isSelected
                            ? "bg-primary/15 text-accent-link ring-2 ring-primary ring-inset"
                            : "bg-card text-foreground ring-1 ring-border ring-inset hover:bg-muted",
                        )}
                      >
                        {time}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        );
      })}
    </div>
  );
}
