import { z } from "zod";

// Mirrors CreateSlotsDto in backend/src/modules/slots (slots.dto.ts). Keep the limits in sync.
export const createSlotsSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a time like 10:00"),
  durationMinutes: z.number().int().min(5).max(240),
  count: z.number().int().min(1, "At least 1").max(12, "At most 12"),
});
export type CreateSlotsInput = z.infer<typeof createSlotsSchema>;

// Mirrors CreateBookingDto in backend/src/modules/slots (slots.dto.ts). Keep the limits in sync.
export const createBookingSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(80, "At most 80 characters"),
  email: z.string().trim().max(254, "At most 254 characters").pipe(z.email("Enter a valid email")),
  note: z.string().trim().max(500, "At most 500 characters"),
});
export type CreateBookingInput = z.infer<typeof createBookingSchema>;

// Response shapes from the API map in docs/plans/README.md.
export type PublicSlot = {
  id: string;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  isBooked: boolean;
};

export type HostSlot = PublicSlot & {
  booking: { id: string; name: string; email: string; note: string | null; createdAt: string } | null;
};

export type BookingConfirmation = { id: string; slot: PublicSlot; name: string; createdAt: string };

export type AppConfig = { timeZone: string; hostName: string; hostKeyRequired: boolean };
