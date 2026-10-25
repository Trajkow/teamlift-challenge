import {z} from 'zod';

export const createBookingSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  note: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => (v ? v : undefined)),
});

export type CreateBookingDto = z.infer<typeof createBookingSchema>;
