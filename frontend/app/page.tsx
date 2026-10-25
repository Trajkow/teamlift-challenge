"use client";

import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api";

export default function Home() {
  const health = useQuery({
    queryKey: ["health"],
    queryFn: () => apiFetch<{ status: string }>("/api/health"),
  });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader title="Slot" description="Pick a time and book it in seconds." />
      <div className="flex items-center gap-2 rounded-xl bg-card p-4 ring-1 ring-border">
        <span className="text-body">Backend</span>
        {health.isPending ? (
          <Badge variant="secondary">Checking</Badge>
        ) : health.isError ? (
          <Badge variant="danger">Unreachable</Badge>
        ) : (
          <Badge variant="success">{health.data.status}</Badge>
        )}
      </div>
    </div>
  );
}
