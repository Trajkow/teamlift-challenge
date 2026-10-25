"use client";

import { KeyRoundIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Asks for the host key when the backend requires one. The key is kept in this browser only. */
export function HostKeyCard({ onSubmit, invalid }: { onSubmit: (key: string) => void; invalid?: boolean }) {
  const [value, setValue] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) onSubmit(value.trim());
      }}
      className="flex flex-col gap-4 rounded-[22px] bg-card p-5 ring-1 ring-border"
    >
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-full bg-primary/12 text-accent-link">
          <KeyRoundIcon className="size-5" aria-hidden />
        </span>
        <div>
          <p className="text-headline">Host key</p>
          <p className="text-subhead text-muted-foreground">Enter the key to manage slots.</p>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="host-key">Key</Label>
        <Input id="host-key" type="password" autoComplete="off" value={value} onChange={(e) => setValue(e.target.value)} aria-invalid={invalid} />
        {invalid ? (
          <p role="alert" className="text-footnote text-destructive">
            That key was not accepted.
          </p>
        ) : null}
      </div>
      <Button type="submit" size="lg" disabled={!value.trim()} className="self-start max-md:w-full">
        Continue
      </Button>
    </form>
  );
}
