import { cn } from "@/lib/utils";

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

/** Initials avatar built from the name; no images. `glass` is for the floating header tile only. */
export function InitialsTile({ name, glass, className }: { name: string; glass?: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center font-semibold",
        glass ? "glass text-foreground" : "bg-primary/12 text-accent-link",
        className,
      )}
    >
      {initialsOf(name)}
    </span>
  );
}
