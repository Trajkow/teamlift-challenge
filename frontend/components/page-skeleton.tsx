import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading placeholder shaped like the content it stands in for: a title line, then either an inset grouped list
 * (default) or stacked cards.
 */
export function PageSkeleton({ variant = "list" }: { variant?: "list" | "cards" }) {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-label="Loading" role="status">
      <Skeleton className="h-9 w-2/5 max-w-xs rounded-xl" />
      {variant === "cards" ? (
        <div className="flex flex-col gap-4">
          {[0, 1].map((i) => (
            <div key={i} className="flex flex-col gap-4 rounded-[22px] bg-card p-5 ring-1 ring-border">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-7 w-40" />
                </div>
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-9 w-32 rounded-full" />
            </div>
          ))}
        </div>
      ) : (
        <div className="divide-y divide-hairline overflow-hidden rounded-[22px] bg-card ring-1 ring-border">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-4">
              <Skeleton className="size-11 shrink-0 rounded-2xl" />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3.5 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
