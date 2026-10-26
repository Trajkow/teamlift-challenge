import {Injectable} from '@nestjs/common';
import {randomUUID} from 'node:crypto';
import {AppError} from '../../common/errors/app-error.js';
import {collectCodes} from '../../common/errors/error-codes.js';
import {isUniqueViolation} from '../../common/errors/unique-violation.js';
import {CalendarBusyService, isBusy} from '../calendar/calendar-busy.service.js';
import type {Interval} from '../calendar/calendar.types.js';
import {ConfirmationMessageService} from '../ai/confirmation-message.service.js';
import {templateMessage} from '../ai/prompt.js';
import {PrismaService} from '../../prisma/prisma.service.js';
import type {CreateBookingDto} from './dto/create-booking.dto.js';
import type {CreateSlotsDto} from './dto/create-slots.dto.js';
import type {ListHostSlotsDto, ListSlotsDto} from './dto/list-slots.dto.js';
import {
  type BookingConfirmation,
  type HostSlot,
  type PublicSlot,
  toHostSlot,
  toPublicSlot,
} from './dto/slot.mapper.js';
import {addDaysTo, startOfDay, todayIn, toInstants} from './slot-time.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HOST_BOOKING = {select: {id: true, name: true, email: true, note: true, createdAt: true}} as const;

export const appTimeZone = () => process.env.APP_TIME_ZONE || 'Europe/Skopje';

const notFound = (what: string) => new AppError(404, 'NOT_FOUND', `${what} not found`);

@Injectable()
export class SlotsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: ConfirmationMessageService,
    private readonly calendar: CalendarBusyService,
  ) {}

  config() {
    return {
      timeZone: appTimeZone(),
      hostName: process.env.HOST_NAME || null,
      hostKeyRequired: !!process.env.HOST_KEY,
      calendarConnected: this.calendar.connected,
    };
  }

  /** Busy intervals covering all given slots (one lookup), or null when unknown. */
  private async busyFor(slots: {startsAt: Date; endsAt: Date}[]): Promise<Interval[] | null> {
    if (slots.length === 0 || !this.calendar.connected) return null;
    const from = new Date(Math.min(...slots.map((s) => s.startsAt.getTime())));
    const to = new Date(Math.max(...slots.map((s) => s.endsAt.getTime())));
    return this.calendar.busyIntervals(from, to);
  }

  async listPublic(query: ListSlotsDto): Promise<PublicSlot[]> {
    const zone = appTimeZone();
    const from = query.from ?? todayIn(zone);
    const to = query.to ?? addDaysTo(from, 30);
    const slots = await this.prisma.slot.findMany({
      where: {
        startsAt: {gt: new Date(), gte: startOfDay(from, zone), lt: startOfDay(to, zone, 1)},
      },
      include: {booking: {select: {id: true}}},
      orderBy: {startsAt: 'asc'},
    });
    const busy = await this.busyFor(slots);
    return slots.map((s) => toPublicSlot(s, !!busy && isBusy(s, busy)));
  }

  async listHost(query: ListHostSlotsDto): Promise<HostSlot[]> {
    const slots = await this.prisma.slot.findMany({
      where: query.includePast ? {} : {startsAt: {gt: new Date()}},
      include: {booking: HOST_BOOKING},
      orderBy: {startsAt: 'asc'},
    });
    const busy = await this.busyFor(slots);
    return slots.map((s) => toHostSlot(s, !!busy && isBusy(s, busy)));
  }

  async createSlots(dto: CreateSlotsDto): Promise<HostSlot[]> {
    const instants = toInstants(dto.date, dto.startTime, appTimeZone(), dto.durationMinutes, dto.count);
    if (!instants) {
      throw new AppError(422, 'INVALID_TIME', 'That start time does not exist on this date (daylight saving gap)');
    }
    if (instants[0].startsAt.getTime() <= Date.now()) {
      throw new AppError(422, 'SLOT_IN_PAST', 'Slots must start in the future');
    }
    const rows = instants.map((i) => ({id: randomUUID(), ...i}));
    // An overlap (23P01) aborts the whole batch; the exception filter turns it into 409 SLOT_OVERLAP.
    const created = await this.prisma.$transaction(async (tx) => {
      await tx.slot.createMany({data: rows});
      return tx.slot.findMany({
        where: {id: {in: rows.map((r) => r.id)}},
        include: {booking: HOST_BOOKING},
        orderBy: {startsAt: 'asc'},
      });
    });
    return created.map((s) => toHostSlot(s));
  }

  async book(slotId: string, dto: CreateBookingDto): Promise<BookingConfirmation> {
    if (!UUID_RE.test(slotId)) throw notFound('Slot');
    // These checks only give clearer errors; UNIQUE (slot_id) is what really prevents a double booking.
    const slot = await this.prisma.slot.findUnique({where: {id: slotId}, include: {booking: {select: {id: true}}}});
    if (!slot) throw notFound('Slot');
    if (slot.startsAt.getTime() <= Date.now()) {
      throw new AppError(422, 'SLOT_IN_PAST', 'This slot has already started');
    }
    if (slot.booking) throw new AppError(409, 'SLOT_TAKEN', 'This slot is already booked');
    // Fresh check (no cache) for this one slot; if the calendar can't be reached the booking goes through.
    const busy = await this.calendar.busyIntervals(slot.startsAt, slot.endsAt, {fresh: true});
    if (busy && isBusy(slot, busy)) {
      throw new AppError(409, 'SLOT_UNAVAILABLE', "This time clashes with the host's calendar.");
    }
    try {
      const booking = await this.prisma.booking.create({
        data: {slotId, name: dto.name, email: dto.email, note: dto.note ?? null},
      });
      return {
        id: booking.id,
        slot: toPublicSlot({...slot, booking: {id: booking.id}}),
        name: booking.name,
        createdAt: booking.createdAt.toISOString(),
      };
    } catch (err) {
      if (isUniqueViolation(err)) throw new AppError(409, 'SLOT_TAKEN', 'This slot is already booked');
      throw err;
    }
  }

  async deleteSlot(id: string): Promise<void> {
    if (!UUID_RE.test(id)) throw notFound('Slot');
    const slot = await this.prisma.slot.findUnique({where: {id}, include: {booking: {select: {id: true}}}});
    if (!slot) throw notFound('Slot');
    if (slot.booking) throw new AppError(409, 'SLOT_BOOKED', 'This slot has a booking; cancel the booking first');
    // onDelete: Restrict still protects against a booking created right after the check (FK violation).
    try {
      await this.prisma.slot.delete({where: {id}});
    } catch (err) {
      const codes = collectCodes(err);
      if (codes.includes('P2025')) throw notFound('Slot');
      if (codes.includes('23503') || codes.includes('P2003')) {
        throw new AppError(409, 'SLOT_BOOKED', 'This slot has a booking; cancel the booking first');
      }
      throw err;
    }
  }

  async cancelBooking(id: string): Promise<void> {
    if (!UUID_RE.test(id)) throw notFound('Booking');
    const {count} = await this.prisma.booking.deleteMany({where: {id}});
    if (count === 0) throw notFound('Booking');
  }

  /** AI confirmation text for a booking, generated once and stored; falls back to a template. Never fails because of the LLM. */
  async confirmationMessage(id: string): Promise<{message: string; source: 'ai' | 'template'}> {
    if (!UUID_RE.test(id)) throw notFound('Booking');
    const booking = await this.prisma.booking.findUnique({where: {id}, include: {slot: true}});
    if (!booking) throw notFound('Booking');
    if (booking.confirmationMessage) return {message: booking.confirmationMessage, source: 'ai'};
    const timeZone = appTimeZone();
    const startsAt = booking.slot.startsAt;
    const generated = await this.ai.generate({
      name: booking.name,
      startsAt,
      durationMinutes: Math.round((booking.slot.endsAt.getTime() - startsAt.getTime()) / 60_000),
      note: booking.note,
      timeZone,
      hostName: process.env.HOST_NAME || null,
    });
    if (!generated) return {message: templateMessage({name: booking.name, startsAt, timeZone}), source: 'template'};
    // Keep the first stored message if two requests raced.
    await this.prisma.booking.updateMany({where: {id, confirmationMessage: null}, data: {confirmationMessage: generated}});
    const stored = await this.prisma.booking.findUnique({where: {id}, select: {confirmationMessage: true}});
    return {message: stored?.confirmationMessage ?? generated, source: 'ai'};
  }
}
