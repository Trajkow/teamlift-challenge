"use client";

import { CalendarCheck2, SunMoon } from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const THEMES = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
] as const;

function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        buttonVariants({ variant: "ghost", size: "sm" }),
        "max-md:min-h-11",
        active
          ? "glass-selected text-[color:var(--glass-selected-label)] hover:bg-[var(--glass-selected)] hover:text-[color:var(--glass-selected-label)] focus-visible:text-[color:var(--glass-selected-label)]"
          : "text-foreground/70",
      )}
    >
      {children}
    </Link>
  );
}

export function AppNav() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();

  return (
    <header className="sticky top-[var(--nav-top)] z-40 px-3">
      <nav
        className="glass mx-auto flex h-[var(--nav-height)] max-w-5xl items-center gap-1 rounded-full pr-2 pl-4"
        aria-label="Main"
      >
        <Link
          href="/"
          className="mr-2 flex items-center gap-2 rounded-full text-headline text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/85 max-md:min-h-11 md:mr-4"
        >
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <CalendarCheck2 className="size-4" aria-hidden />
          </span>
          Slot
        </Link>

        {/* Book and Host stay in the capsule on every screen size; there is no bottom tab bar. */}
        <div className="flex items-center gap-1">
          <NavLink href="/" active={pathname === "/"}>
            Book
          </NavLink>
          <NavLink href="/host" active={pathname.startsWith("/host")}>
            Host
          </NavLink>
        </div>

        <div className="ml-auto flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="glass" size="sm" aria-label="Theme" className="gap-2" />}>
              <SunMoon className="size-4" aria-hidden />
              <span className="hidden md:inline">Theme</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={8} className="min-w-40">
              <DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={(v) => setTheme(String(v))}>
                {THEMES.map((t) => (
                  <DropdownMenuRadioItem key={t.value} value={t.value}>
                    {t.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </nav>
    </header>
  );
}
