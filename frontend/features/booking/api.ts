import { apiFetch } from "@/lib/api";
import type { BookingConfirmation, ConfirmationMessage, PublicSlot } from "@/lib/schemas/slots";

export const getSlots = () => apiFetch<PublicSlot[]>("/api/slots");

export const createBooking = (slotId: string, input: { name: string; email: string; note?: string }) =>
  apiFetch<BookingConfirmation>(`/api/slots/${slotId}/bookings`, { method: "POST", body: input });

export const getConfirmationMessage = (bookingId: string) =>
  apiFetch<ConfirmationMessage>(`/api/bookings/${bookingId}/confirmation-message`, { method: "POST" });
