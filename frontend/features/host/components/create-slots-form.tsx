"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarIcon, Loader2Icon } from "lucide-react";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { applyIssues } from "@/lib/forms";
import { toastError } from "@/lib/error-messages";
import { createSlotsSchema, type CreateSlotsInput } from "@/lib/schemas/slots";
import { formatDate, todayIn } from "@/lib/time";
import { useCreateSlots } from "../hooks";

const FIELDS = ["date", "startTime", "durationMinutes", "count"] as const;
const DURATIONS = [15, 30, 45, 60, 90].map((m) => ({ value: String(m), label: `${m} min` }));

function toLocalDate(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function fromLocalDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** The start times a submit would create, e.g. ["10:00", "10:30"], or null while the inputs are incomplete. */
function previewTimes(startTime: string, duration: number, count: number): string[] | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(startTime);
  if (!match || !Number.isInteger(count) || count < 1 || count > 12 || !duration) return null;
  const start = Number(match[1]) * 60 + Number(match[2]);
  return Array.from({ length: count }, (_, i) => {
    const t = (start + i * duration) % (24 * 60);
    return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
  });
}

export function CreateSlotsForm({ timeZone }: { timeZone: string }) {
  const create = useCreateSlots();
  const [today] = useState(() => todayIn(timeZone));
  const [calendarOpen, setCalendarOpen] = useState(false);
  const {
    register,
    control,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateSlotsInput>({
    resolver: zodResolver(createSlotsSchema),
    defaultValues: { date: today, startTime: "10:00", durationMinutes: 30, count: 1 },
  });
  const pending = isSubmitting || create.isPending;
  const [startTime, duration, count] = useWatch({ control, name: ["startTime", "durationMinutes", "count"] });
  const preview = previewTimes(startTime, duration, Number(count));

  async function onSubmit(values: CreateSlotsInput) {
    try {
      const created = await create.mutateAsync(values);
      toast.success(created.length === 1 ? "Slot created" : `${created.length} slots created`);
      setValue("startTime", "");
    } catch (err) {
      if (applyIssues(err, setError, FIELDS)) return;
      toastError(err);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4 rounded-[22px] bg-card p-5 ring-1 ring-border">
      <h2 className="text-headline">Publish slots</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="slot-date">Date</Label>
          <Controller
            control={control}
            name="date"
            render={({ field }) => (
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger
                  render={
                    <Button id="slot-date" type="button" variant="secondary" aria-invalid={!!errors.date} className="h-11 w-full justify-start rounded-lg px-3.5 font-normal md:h-10" />
                  }
                >
                  <CalendarIcon aria-hidden />
                  {field.value ? formatDate(field.value, { weekday: "short", month: "short", day: "numeric", year: "numeric" }) : "Pick a date"}
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto p-2">
                  <Calendar
                    mode="single"
                    selected={field.value ? toLocalDate(field.value) : undefined}
                    onSelect={(d) => {
                      if (d) {
                        field.onChange(fromLocalDate(d));
                        setCalendarOpen(false);
                      }
                    }}
                    disabled={{ before: toLocalDate(today) }}
                    defaultMonth={field.value ? toLocalDate(field.value) : undefined}
                  />
                </PopoverContent>
              </Popover>
            )}
          />
          {errors.date ? <p role="alert" className="text-footnote text-destructive">{errors.date.message}</p> : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="slot-start">Start time</Label>
          <Input id="slot-start" type="time" aria-invalid={!!errors.startTime} {...register("startTime")} />
          {errors.startTime ? <p role="alert" className="text-footnote text-destructive">{errors.startTime.message}</p> : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="slot-duration">Duration</Label>
          <Controller
            control={control}
            name="durationMinutes"
            render={({ field }) => (
              <Select items={DURATIONS} value={String(field.value)} onValueChange={(v) => v && field.onChange(Number(v))}>
                <SelectTrigger id="slot-duration" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DURATIONS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.durationMinutes ? <p role="alert" className="text-footnote text-destructive">{errors.durationMinutes.message}</p> : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="slot-count">How many back-to-back</Label>
          <Input id="slot-count" type="number" inputMode="numeric" min={1} max={12} aria-invalid={!!errors.count} {...register("count", { valueAsNumber: true })} />
          {errors.count ? <p role="alert" className="text-footnote text-destructive">{errors.count.message}</p> : null}
        </div>
      </div>
      <p className="text-subhead text-muted-foreground" aria-live="polite">
        {preview ? `Creates ${preview.length} ${preview.length === 1 ? "slot" : "slots"}: ${preview.join(", ")} (${timeZone} time)` : "Enter a start time to preview the slots."}
      </p>
      <Button type="submit" size="lg" disabled={pending} className="self-start max-md:w-full">
        {pending ? <Loader2Icon className="animate-spin motion-reduce:animate-none" aria-hidden /> : null}
        {pending ? "Creating..." : "Create slots"}
      </Button>
    </form>
  );
}
