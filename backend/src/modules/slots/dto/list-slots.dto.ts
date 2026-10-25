import {z} from 'zod';
import {dateString} from './create-slots.dto.js';

export const listSlotsSchema = z.object({
  from: dateString.optional(),
  to: dateString.optional(),
});
export type ListSlotsDto = z.infer<typeof listSlotsSchema>;

export const listHostSlotsSchema = z.object({
  includePast: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
});
export type ListHostSlotsDto = z.infer<typeof listHostSlotsSchema>;
