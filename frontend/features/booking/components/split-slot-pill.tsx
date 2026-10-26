"use client";

import { ArrowRightIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { PublicSlot } from "@/lib/schemas/slots";
import { cn } from "@/lib/utils";

const FOCUS_RING = "outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring";

/** The selected free slot: time on the left (click to deselect), a solid "Book" button on the right.
 *  Focus moves to Book on mount, so Enter then Enter books. Escape on either half deselects. */
export function SplitSlotPill({
  slot,
  time,
  dayLabel,
  onDeselect,
  onBook,
}: {
  slot: PublicSlot;
  time: string;
  dayLabel: string;
  onDeselect: () => void;
  onBook: () => void;
}) {
  const bookRef = useRef<HTMLButtonElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    // Flip after the first paint so the Book half transitions in.
    const raf = requestAnimationFrame(() => setShown(true));
    bookRef.current?.focus({ preventScroll: false });
    return () => cancelAnimationFrame(raf);
  }, []);

  function deselect() {
    onDeselect();
    // The plain pill mounts in place of this one; hand focus back to its time button.
    requestAnimationFrame(() => {
      document.querySelector<HTMLButtonElement>(`[data-slot-time="${slot.id}"]`)?.focus();
    });
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      deselect();
    }
  }

  return (
    <div
      onKeyDown={onKeyDown}
      className="flex h-11 w-full overflow-hidden rounded-full bg-primary/15 ring-2 ring-primary ring-inset"
    >
      <button
        type="button"
        aria-pressed
        aria-label={`${time} on ${dayLabel}, selected, ${slot.durationMinutes} minutes. Press to deselect`}
        onClick={deselect}
        className={cn(
          "flex min-w-0 flex-1 flex-col items-center justify-center text-accent-link transition-colors duration-200 ease-out hover:bg-primary/10",
          FOCUS_RING,
        )}
      >
        <span className="text-[0.9375rem] leading-none font-medium whitespace-nowrap tabular-nums">{time}</span>
        <span className="mt-0.5 text-caption leading-none">{slot.durationMinutes} min</span>
      </button>
      <button
        ref={bookRef}
        type="button"
        aria-label={`Book ${dayLabel} at ${time}`}
        onClick={onBook}
        className={cn(
          "flex min-w-0 flex-1 items-center justify-center gap-1 border-l border-primary-foreground/30 bg-primary text-[0.9375rem] font-medium whitespace-nowrap text-primary-foreground transition-[opacity,translate,background-color] duration-200 ease-out hover:bg-primary/90 active:bg-primary/80",
          FOCUS_RING,
          shown ? "translate-x-0 opacity-100" : "translate-x-3 opacity-0",
        )}
      >
        Book
        <ArrowRightIcon className="size-4" aria-hidden />
      </button>
    </div>
  );
}
