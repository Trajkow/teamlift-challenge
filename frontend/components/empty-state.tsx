import { InboxIcon, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Icon, headline, one line and at most one CTA. Solid surface; never glass. */
export function EmptyState({
  icon: Icon = InboxIcon,
  title,
  description,
  action,
  compact,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  /** Smaller padding, for a section inside a page that already has other content. */
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-[22px] bg-card text-center ring-1 ring-border",
        compact ? "p-6" : "px-6 py-10",
      )}
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-primary/12 text-accent-link">
        <Icon className="size-6" aria-hidden />
      </span>
      <div className="flex flex-col gap-1">
        <p className="text-headline">{title}</p>
        {description ? <p className="mx-auto max-w-md text-subhead text-muted-foreground">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
