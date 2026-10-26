"use client";

import { CalendarCheck2Icon, TriangleAlertIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toastError } from "@/lib/error-messages";
import { calendarConnectUrl } from "../api";
import { useCalendarStatus, useDisconnectCalendar } from "../hooks";

/** Host page card: connect, reconnect or disconnect the Google Calendar that marks slots as Busy. */
export function CalendarCard({ hostKey }: { hostKey: string | null }) {
  const status = useCalendarStatus(true);
  const disconnect = useDisconnectCalendar();
  const [confirming, setConfirming] = useState(false);

  if (status.isError) return null; // Optional extra: the page works without it.
  if (!status.data) return <Skeleton className="h-[116px] rounded-[22px]" />;

  const { source, email, needsReconnect, oauthAvailable } = status.data;
  const connectHref = calendarConnectUrl(hostKey);
  const connectLink = (label: string, variant: "default" | "secondary" = "default") => (
    <a href={connectHref} className={buttonVariants({ variant, size: "lg" }) + " self-start max-md:w-full"}>
      {label}
    </a>
  );

  let title = "Google Calendar";
  let text = "Guests see slots that clash with your calendar as Busy. Only busy times are read, never event details.";
  let action: React.ReactNode = oauthAvailable ? connectLink("Connect Google Calendar") : null;
  if (!oauthAvailable && !source) text = "Calendar sign-in is not set up on this server.";
  let tone: "ok" | "warn" | "off" = "off";

  if (source === "oauth" && needsReconnect) {
    tone = "warn";
    title = "Reconnect Google Calendar";
    text = `Google stopped accepting the connection for ${email}. Until you reconnect, no slots are marked Busy.`;
    action = oauthAvailable ? connectLink("Reconnect") : null;
  } else if (source === "oauth") {
    tone = "ok";
    title = `Connected as ${email}`;
    text = "Slots that clash with this calendar show as Busy. Connecting again replaces the site's calendar.";
    action = (
      <div className="flex flex-wrap gap-2 max-md:flex-col">
        <Button variant="secondary" size="lg" onClick={() => setConfirming(true)}>
          Disconnect
        </Button>
        {oauthAvailable ? connectLink("Connect another", "secondary") : null}
      </div>
    );
  } else if (source === "service_account") {
    tone = "ok";
    title = "Using the site's default calendar";
    text = "Slots that clash with it show as Busy. Connecting your own calendar replaces the site's calendar.";
  }

  const Icon = tone === "warn" ? TriangleAlertIcon : CalendarCheck2Icon;
  return (
    <section aria-label="Google Calendar" className="flex flex-col gap-4 rounded-[22px] bg-card p-5 ring-1 ring-border">
      <div className="flex items-center gap-3">
        <span
          className={`flex size-10 shrink-0 items-center justify-center rounded-full ${tone === "warn" ? "bg-warning-bg text-warning" : tone === "ok" ? "bg-success-bg text-success" : "bg-primary/12 text-accent-link"}`}
        >
          <Icon className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="truncate text-headline">{title}</p>
          <p className="text-subhead text-muted-foreground">{text}</p>
        </div>
      </div>
      {action}
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Disconnect Google Calendar?"
        description={
          status.data.connected
            ? "Slots will stop being checked against this calendar. If the site has a default calendar, that one is used instead."
            : "Slots will stop being checked against your calendar."
        }
        confirmLabel="Disconnect"
        destructive
        pending={disconnect.isPending}
        onConfirm={() =>
          disconnect.mutate(undefined, {
            onSuccess: () => {
              toast.success("Google Calendar disconnected");
              setConfirming(false);
            },
            onError: (err) => toastError(err, "Could not disconnect"),
          })
        }
      />
    </section>
  );
}
