import type { Metadata } from "next";
import { BookingPage } from "@/features/booking/components/booking-page";

export const metadata: Metadata = { title: "Book a time" };

export default function Home() {
  return <BookingPage />;
}
