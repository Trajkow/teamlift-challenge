import { TriangleAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";

export function ErrorState({
  error,
  title = "Something went wrong",
  onRetry,
}: {
  error?: unknown;
  title?: string;
  onRetry?: () => void;
}) {
  const message = error instanceof ApiError || error instanceof Error ? error.message : "Please try again.";
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-[22px] bg-card px-6 py-10 text-center ring-1 ring-border"
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-danger-bg text-danger">
        <TriangleAlertIcon className="size-6" aria-hidden />
      </span>
      <div className="flex flex-col gap-1">
        <p className="text-headline">{title}</p>
        <p className="mx-auto max-w-md text-subhead text-muted-foreground">{message}</p>
      </div>
      {onRetry ? (
        <Button variant="glass" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
