"use client";

import { CalendarDays, CalendarCog, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type Tab = { href: string; label: string; icon: LucideIcon; exact?: boolean };

const TABS: Tab[] = [
  { href: "/", label: "Book", icon: CalendarDays, exact: true },
  { href: "/host", label: "Host", icon: CalendarCog },
];

const itemClass =
  "flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-full px-2 text-[0.6875rem] font-medium transition-colors duration-200 ease-out outline-none focus-visible:ring-3 focus-visible:ring-ring/85";
const activeClass = "bg-primary/15 text-accent-on-tint";
const idleClass = "text-foreground/70 hover:text-foreground";

export function MobileTabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Tabs"
      className="glass fixed inset-x-3 bottom-[var(--tabbar-bottom)] z-40 mx-auto flex h-[var(--tabbar-height)] max-w-md items-center gap-1 rounded-full p-1 md:hidden"
    >
      {TABS.map((t) => {
        const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
        const Icon = t.icon;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cn(itemClass, active ? activeClass : idleClass)}
          >
            <Icon className="size-5" aria-hidden />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
