"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon } from "lucide-react";
import { useForm } from "react-hook-form";
import { ResponsiveModal } from "@/components/responsive-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { applyIssues } from "@/lib/forms";
import { isApiError, toastError } from "@/lib/error-messages";
import { createBookingSchema, type BookingConfirmation, type CreateBookingInput, type PublicSlot } from "@/lib/schemas/slots";
import { formatInstant, formatClock } from "@/lib/time";
import { useBook } from "../hooks";

const FIELDS = ["name", "email", "note"] as const;

/** Name, email and an optional note for the chosen slot. A taken slot closes the dialog with a toast. */
export function BookingDialog({
  slot,
  timeZone,
  onClose,
  onBooked,
  onSlotGone,
}: {
  slot: PublicSlot;
  timeZone: string;
  onClose: () => void;
  onBooked: (booking: BookingConfirmation) => void;
  onSlotGone: () => void;
}) {
  const book = useBook();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateBookingInput>({
    resolver: zodResolver(createBookingSchema),
    defaultValues: { name: "", email: "", note: "" },
  });
  const pending = isSubmitting || book.isPending;

  async function onSubmit(values: CreateBookingInput) {
    try {
      const booking = await book.mutateAsync({
        slotId: slot.id,
        name: values.name,
        email: values.email,
        note: values.note || undefined,
      });
      onBooked(booking);
    } catch (err) {
      if (isApiError(err, "SLOT_TAKEN") || isApiError(err, "SLOT_IN_PAST") || isApiError(err, "NOT_FOUND")) {
        toastError(err);
        onSlotGone();
        return;
      }
      if (applyIssues(err, setError, FIELDS)) return;
      toastError(err);
    }
  }

  return (
    <ResponsiveModal
      onClose={() => !pending && onClose()}
      title="Book this time"
      description={`${formatInstant(slot.startsAt, timeZone, { weekday: "long", month: "long", day: "numeric" })}, ${formatClock(slot.startsAt, timeZone)} to ${formatClock(slot.endsAt, timeZone)} (${slot.durationMinutes} min)`}
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="booking-name">Name</Label>
          <Input id="booking-name" autoComplete="name" aria-invalid={!!errors.name} aria-describedby={errors.name ? "booking-name-error" : undefined} {...register("name")} />
          {errors.name ? <p id="booking-name-error" role="alert" className="text-footnote text-destructive">{errors.name.message}</p> : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="booking-email">Email</Label>
          <Input id="booking-email" type="email" autoComplete="email" inputMode="email" aria-invalid={!!errors.email} aria-describedby={errors.email ? "booking-email-error" : undefined} {...register("email")} />
          {errors.email ? <p id="booking-email-error" role="alert" className="text-footnote text-destructive">{errors.email.message}</p> : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="booking-note">Note (optional)</Label>
          <Textarea id="booking-note" rows={3} placeholder="Anything you want to cover?" aria-invalid={!!errors.note} aria-describedby={errors.note ? "booking-note-error" : undefined} {...register("note")} />
          {errors.note ? <p id="booking-note-error" role="alert" className="text-footnote text-destructive">{errors.note.message}</p> : null}
        </div>
        <Button type="submit" size="lg" disabled={pending} className="w-full">
          {pending ? <Loader2Icon className="animate-spin motion-reduce:animate-none" aria-hidden /> : null}
          {pending ? "Booking..." : "Confirm booking"}
        </Button>
      </form>
    </ResponsiveModal>
  );
}
