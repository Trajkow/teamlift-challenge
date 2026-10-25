import {DateTime} from 'luxon';
import {z} from 'zod';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** `YYYY-MM-DD` that is also a real calendar day. */
export const dateString = z
  .string()
  .regex(DATE_RE, 'Use the format YYYY-MM-DD')
  .refine((v) => DateTime.fromISO(v, {zone: 'utc'}).isValid, 'Not a real calendar date');

export const createSlotsSchema = z.object({
  date: dateString,
  startTime: z.string().regex(TIME_RE, 'Use the 24-hour format HH:mm'),
  durationMinutes: z.number().int().min(5).max(240),
  count: z.number().int().min(1).max(12).default(1),
});

export type CreateSlotsDto = z.infer<typeof createSlotsSchema>;
