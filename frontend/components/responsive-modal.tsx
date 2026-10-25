"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const DESKTOP_QUERY = "(min-width: 768px)";

/** True from `md` up. Server snapshot is desktop; the modals below only mount after a click, on the client. */
export function useIsDesktop() {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(DESKTOP_QUERY);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => true,
  );
}

/** A glass dialog on desktop and a glass bottom sheet below `md`. Same content either way. */
export function ResponsiveModal({
  onClose,
  title,
  description,
  wide,
  showCloseButton = true,
  children,
}: {
  onClose: () => void;
  title: ReactNode;
  description: ReactNode;
  wide?: boolean;
  showCloseButton?: boolean;
  children: ReactNode;
}) {
  const isDesktop = useIsDesktop();
  if (isDesktop) {
    return (
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent className={cn(wide && "sm:max-w-3xl")} showCloseButton={showCloseButton}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {children}
        </DialogContent>
      </Dialog>
    );
  }
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" showCloseButton={showCloseButton} className="data-[side=bottom]:max-h-[92dvh]">
        <SheetHeader className="pr-12">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-5 pb-5">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
