import { zonedParts } from "@/lib/time";

/** Groups items (already sorted by `startsAt`) by calendar day in `timeZone`. */
export function groupByDay<T extends { startsAt: string }>(items: T[], timeZone: string): { date: string; items: T[] }[] {
  const groups: { date: string; items: T[] }[] = [];
  for (const item of items) {
    const date = zonedParts(item.startsAt, timeZone).date;
    const last = groups[groups.length - 1];
    if (last && last.date === date) last.items.push(item);
    else groups.push({ date, items: [item] });
  }
  return groups;
}
