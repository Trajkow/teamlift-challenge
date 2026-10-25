import {DateTime} from 'luxon';

let counter = 0;

/** A distinct future local date (far ahead, one day apart) so tests never collide on the overlap constraint. */
export function uniqueFutureDate(): string {
  counter += 1;
  const offset = 400 + counter * 2 + (process.pid % 1000) * 100;
  return DateTime.now().plus({days: offset}).toFormat('yyyy-MM-dd');
}
