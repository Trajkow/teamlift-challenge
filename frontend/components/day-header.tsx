import type { ReactNode } from "react";
import { formatDate } from "@/lib/time";

/** Sticky pill above a day's group. The band is transparent so only the pill covers content scrolling beneath. */
export function DayHeader({ date, today, trailing }: { date: string; today: string; trailing?: ReactNode }) {
  const isToday = date === today;
  return (
    <div className="pointer-events-none sticky top-[var(--sticky-top)] z-10 py-2">
      <h3 className="pointer-events-auto inline-flex items-center rounded-full bg-card px-3 py-1 text-footnote font-semibold text-foreground ring-1 ring-border">
        {isToday ? "Today" : formatDate(date, { weekday: "long", month: "short", day: "numeric" })}
        {isToday ? <span className="ml-1.5 font-normal text-muted-foreground">{formatDate(date, { month: "short", day: "numeric" })}</span> : null}
        {trailing ? <span className="ml-2 font-normal text-muted-foreground">{trailing}</span> : null}
      </h3>
    </div>
  );
}
