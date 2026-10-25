import type { Metadata } from "next";
import { HostPage } from "@/features/host/components/host-page";

export const metadata: Metadata = { title: "Host" };

export default function Host() {
  return <HostPage />;
}
