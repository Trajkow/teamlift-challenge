import type { Metadata } from "next";
import "./globals.css";
import { AppNav } from "@/components/app-nav";
import { Providers } from "@/lib/query-client";

export const metadata: Metadata = {
  title: { default: "Slot", template: "%s · Slot" },
  description: "Pick a time and book it in seconds. One slot, one guest, never double booked.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className="h-full antialiased"
    >
      <body className="relative flex min-h-full flex-col bg-background">
        <Providers>
          {/* Soft ambient washes behind the nav; they fade out well before body text. */}
          <div
            aria-hidden
            className="ambient pointer-events-none absolute inset-x-0 top-0 -z-10 h-[34rem] [mask-image:linear-gradient(to_bottom,#000_55%,transparent)]"
          />
          <AppNav />
          <main className="mx-auto w-full max-w-6xl min-w-0 flex-1 overflow-x-clip px-4 pt-8 pb-[var(--page-pad-bottom)]">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
