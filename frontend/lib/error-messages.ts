import { toast } from "sonner";
import { ApiError } from "@/lib/api";

/** Backend error codes -> messages for people. One place, shared by the guest and host pages. */
const MESSAGES: Record<string, string> = {
  SLOT_TAKEN: "Someone just booked that time. Please pick another slot.",
  SLOT_OVERLAP: "That time overlaps a slot you already published.",
  SLOT_BOOKED: "That slot has a booking. Cancel the booking first.",
  SLOT_IN_PAST: "That time has already passed.",
  HOST_KEY_REQUIRED: "Enter the host key to continue.",
  CONCURRENT_MODIFICATION: "That changed at the same time as another request. Please try again.",
  NOT_FOUND: "We could not find that.",
  VALIDATION_FAILED: "Some of the values are not valid.",
  RATE_LIMITED: "Too many attempts, try again in a minute.",
  INTERNAL: "Something went wrong on our side. Please try again.",
};

export function errorMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
  if (err instanceof ApiError) return MESSAGES[err.code] ?? err.message ?? fallback;
  if (err instanceof Error) return err.message || fallback;
  return fallback;
}

export function toastError(err: unknown, fallback?: string) {
  toast.error(errorMessage(err, fallback));
}

export function isApiError(err: unknown, code: string): boolean {
  return err instanceof ApiError && err.code === code;
}
