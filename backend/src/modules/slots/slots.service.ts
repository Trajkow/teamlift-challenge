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

export type ConfirmationResult =
  | {status: 'ready'; message: string; source: 'ai' | 'template'}
  | {status: 'pending'};
/** How long a failed generation is remembered, so polling gets the template instead of starting it again. */
const FAILED_TTL_MS = 10 * 60_000;

@Injectable()
export class SlotsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: ConfirmationMessageService,
    private readonly calendar: CalendarBusyService,
  ) {}

  /** AI confirmations in flight or failed, by booking id. In memory: one backend instance. */
  private readonly generations = new Map<string, {state: 'pending'} | {state: 'failed'; at: number}>();

  async config() {
    return {
      timeZone: appTimeZone(),
      hostName: process.env.HOST_NAME || null,
      hostKeyRequired: !!process.env.HOST_KEY,
      calendarConnected: await this.calendar.isConnected(),
    };
  }

  /** Busy intervals covering all given slots (one lookup), or null when unknown. */
  private async busyFor(slots: {startsAt: Date; endsAt: Date}[]): Promise<Interval[] | null> {
    if (slots.length === 0) return null;
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
      // Start the AI message now; the free tier takes 15 to 25 s, and the success screen polls for it.
      this.startGeneration(booking.id);
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

  /**
   * AI confirmation for a booking. Returns the stored AI text, `pending` while it is being generated, or the template
   * when there is no key or generation failed. Never fails because of the LLM.
   */
  async confirmationMessage(id: string): Promise<ConfirmationResult> {
    if (!UUID_RE.test(id)) throw notFound('Booking');
    const booking = await this.prisma.booking.findUnique({where: {id}, include: {slot: true}});
    if (!booking) throw notFound('Booking');
    if (booking.confirmationMessage) return {status: 'ready', message: booking.confirmationMessage, source: 'ai'};
    const template = (): ConfirmationResult => ({
      status: 'ready',
      message: templateMessage({name: booking.name, startsAt: booking.slot.startsAt, timeZone: appTimeZone()}),
      source: 'template',
    });
    if (!this.ai.isEnabled()) return template();
    const job = this.generations.get(id);
    if (job?.state === 'failed' && Date.now() - job.at < FAILED_TTL_MS) return template();
    // Not started yet (for example after a restart): start it and let the caller poll.
    if (job?.state !== 'pending') this.startGeneration(id);
    return {status: 'pending'};
  }

  /** Generates and stores the AI message in the background. Never throws; a failure is remembered for polling. */
  private startGeneration(id: string): void {
    if (!this.ai.isEnabled() || this.generations.get(id)?.state === 'pending') return;
    this.generations.set(id, {state: 'pending'});
    void this.generate(id)
      .then((ok) => (ok ? this.generations.delete(id) : this.generations.set(id, {state: 'failed', at: Date.now()})))
      .catch(() => this.generations.set(id, {state: 'failed', at: Date.now()}));
  }

  private async generate(id: string): Promise<boolean> {
    const booking = await this.prisma.booking.findUnique({where: {id}, include: {slot: true}});
    if (!booking) return false;
    if (booking.confirmationMessage) return true;
    const startsAt = booking.slot.startsAt;
    const generated = await this.ai.generate({
      name: booking.name,
      startsAt,
      durationMinutes: Math.round((booking.slot.endsAt.getTime() - startsAt.getTime()) / 60_000),
      note: booking.note,
      timeZone: appTimeZone(),
      hostName: process.env.HOST_NAME || null,
    });
    if (!generated) return false;
    // Keep the first stored message if two generations raced.
    await this.prisma.booking.updateMany({where: {id, confirmationMessage: null}, data: {confirmationMessage: generated}});
    return true;
  }
}
