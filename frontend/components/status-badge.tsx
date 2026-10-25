import { Badge } from "@/components/ui/badge";

/** Availability of a slot: open for booking, or already taken. */
export function StatusBadge({ booked }: { booked: boolean }) {
  return <Badge variant={booked ? "secondary" : "success"}>{booked ? "Booked" : "Available"}</Badge>;
}
