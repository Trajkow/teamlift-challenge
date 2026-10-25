export type SlotRow = {id: string; startsAt: Date; endsAt: Date};
type PublicSlotInput = SlotRow & {booking: {id: string} | null};
type HostSlotInput = SlotRow & {
  booking: {id: string; name: string; email: string; note: string | null; createdAt: Date} | null;
};

export type PublicSlot = {id: string; startsAt: string; endsAt: string; durationMinutes: number; isBooked: boolean};
export type HostSlot = PublicSlot & {
  booking: {id: string; name: string; email: string; note: string | null; createdAt: string} | null;
};
export type BookingConfirmation = {id: string; slot: PublicSlot; name: string; createdAt: string};

/** Public view: never reads booker details. */
export function toPublicSlot(slot: PublicSlotInput): PublicSlot {
  return {
    id: slot.id,
    startsAt: slot.startsAt.toISOString(),
    endsAt: slot.endsAt.toISOString(),
    durationMinutes: Math.round((slot.endsAt.getTime() - slot.startsAt.getTime()) / 60_000),
    isBooked: slot.booking !== null,
  };
}

/** Host view: the only mapper allowed to expose booking name, email and note. */
export function toHostSlot(slot: HostSlotInput): HostSlot {
  return {
    ...toPublicSlot(slot),
    booking: slot.booking && {
      id: slot.booking.id,
      name: slot.booking.name,
      email: slot.booking.email,
      note: slot.booking.note,
      createdAt: slot.booking.createdAt.toISOString(),
    },
  };
}
