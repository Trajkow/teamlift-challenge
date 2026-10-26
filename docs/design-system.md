# Design system ("Slot")

Apple-style UI with Liquid Glass on the floating navigation and control layer. Source of truth for tokens is
`frontend/app/globals.css`; this page explains how to use them.

## Tokens

Use tokens through Tailwind (`bg-card`, `text-muted-foreground`, `text-accent-link`, `bg-success-bg`...). Never write raw
hex or `rgb()` colours in components, with three documented exceptions: the solid brand button hover/active shades in
`button.tsx`, the orange "needs confirmation" dot/badge (`#FF9F0A` with `#1D1D1F` text), and the destructive solid fill.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--canvas` (`bg-background`) | `#F5F5F7` | `#121214` | page background |
| `--surface` (`bg-card`) | `#FFFFFF` | `#1F1F22` | cards, lists, forms |
| `--surface-raised` (`bg-popover`) | `#FFFFFF` | `#2E2E32` | popups, glass fallback |
| `--label` (`text-foreground`) | `#1D1D1F` | `#F5F5F7` | primary text |
| `--label-secondary` (`text-muted-foreground`) | `#6E6E73` | `#A4A4A9` | secondary text on solid surfaces |
| `--glass-secondary` | `#4E4E53` | `#B8B8BD` | `text-muted-foreground` is remapped to this inside `.glass` and `.glass-thick` |
| `--hairline` (`border-border`) | `rgba(0,0,0,.08)` | `rgba(255,255,255,.12)` | separators, card rings |
| `--field` (`bg-field`) | `rgba(120,120,128,.10)` | `rgba(120,120,128,.24)` | input fill |
| `--primary` | `#0071E3` | `#0071E3` | filled buttons (white text, both modes) |
| `--accent-link` (`text-accent-link`) | `#0066CC` | `#2997FF` | links and accent text on solid surfaces |
| `--accent-on-tint` | `#00479E` | `#A8D2FF` | accent text on an accent tint (default badge) |

Radius: controls 12 px (`rounded-lg`), cards 18 px (`rounded-xl`) to 22 px, dialogs/sheets 26-28 px, buttons and chips are
pills (`rounded-full`). Motion: 150-250 ms ease-out (`--duration*`, `--ease-out`); everything respects
`prefers-reduced-motion` (a global guard in `globals.css`, plus no press scale).

## Type scale

System stack (`-apple-system, BlinkMacSystemFont, "SF Pro Text", ... system-ui`), mono `ui-monospace`. No web fonts.

| Utility | Size / weight | Use |
|---|---|---|
| `text-large-title` | 40 / 600 / -2% | page titles (`PageHeader`) |
| `text-title` | 28 / 600 / -1.5% | section titles, big times |
| `text-headline` | 17 / 600 | row titles, card headings |
| `text-body` | 17 / 400, line height 1.47 | body (default) |
| `text-subhead` | 15 | secondary lines |
| `text-footnote` | 13 | helper text, footnotes |
| `text-caption` | 12 | pills, tiny labels |

## Liquid Glass

CSS only: `.glass` (nav, pills, segmented controls), `.glass-thick` (dialogs, sheets, menus, popovers), `.glass-hover`,
`glass-pressed`, `glass-selected` (the raised opaque white selection pill) and `.ambient` (soft colour washes on the
canvas). Material: translucent tint, `blur(22px) saturate(180%)`, 1 px rim, inner highlight, drop shadow, and a
`::before` specular sheen.

**Allowed only on the floating navigation and control layer:** top nav capsule,
segmented controls, secondary (`glass`) pills, menus, popovers, dialogs, sheets and toasts. Booking happens on the selected slot itself (a split "time │ Book →" pill), so there is no floating booking bar.

**Never on content:** cards, list rows, forms, slot buttons, tables. Those stay on solid `bg-card` surfaces. Keep to
about four glass layers on screen at once. Never animate `backdrop-filter`. Never put body text on `.ambient` without a
solid surface.

**Fallbacks (mandatory).** Under `prefers-reduced-transparency: reduce` and when `backdrop-filter` is unsupported, the
glass tokens switch to a solid `--surface-raised` with a hairline border, no sheen, no blur on modal scrims and toasts,
and the ambient washes are removed. Test both themes with the fallback on.

**Text on glass** uses label colours or `text-muted-foreground` (remapped to `--glass-secondary` inside glass). Do not use
`text-foreground/50` or lighter on glass.

## Floating chrome geometry

Defined once in `globals.css` and used everywhere; never hard-code these numbers.

| Variable | Meaning |
|---|---|
| `--nav-top`, `--nav-height` | top capsule: 12 px from the top, 56 px high |
| `--sticky-top` | sticky content (day headers) and toasts sit here, 8 px below the nav |
| `--float-bottom` | anything floating near the bottom edge: 16 px + safe area |
| `--page-pad-bottom` | bottom padding of `main` (3 rem + safe area) |

## Components

- `components/ui/*`: shadcn on Base UI, restyled. `Button` variants: `default` (solid blue), `glass` (secondary pill),
  `outline`, `secondary`, `ghost`, `destructive` (red text on a tint), `destructive-solid` (final confirm), `link`. Buttons
  are pills; below `md` they are at least 44 px tall.
- `Tabs` is a glass segmented control with a raised white selection pill.
- `Dialog`, `Sheet` (`side="bottom"` is the mobile sheet), `DropdownMenu`, `Popover`, `Select` popups: `glass-thick`.
- `ResponsiveModal`: dialog on desktop, bottom sheet below `md`.
- `PageHeader`: large title, optional description and actions.
- `EmptyState`: icon, headline, one line, at most one CTA, on a solid card. `ErrorState`: same shape with a danger
  icon and a retry. `PageSkeleton`: title line plus a grouped list (`variant="list"`) or cards (`variant="cards"`).
- `StatusBadge`: "Available" (success) or "Booked" (neutral) for a slot.
- `ConfirmDialog`: glass dialog; "Keep it" (secondary) and a confirm (solid red when destructive).
- `InitialsTile` (initials from the name; no images).
- Lists: inset grouped list = `divide-y divide-hairline overflow-hidden rounded-[22px] bg-card ring-1 ring-border`.
  Use grouped lists, not tables.

## Forms

Labels **above** clearly bordered or filled inputs (`Input`, `Textarea`, `SelectTrigger`: 12 px radius, `bg-field`,
accent focus). Do not use iOS-style borderless right-aligned inputs: they were tried and rejected because it is hard to
see where the input is. Errors stay inline under the field. react-hook-form + zod, mirroring backend DTOs.

## Scrollbars and outlines

- Inner scroll areas always use `scroll-slim` (thin, themed, always visible). Never hide scrollbars, never leave the
  browser default.
- Items packed tightly in a scroll container (slot buttons, list rows) use `ring-inset` or an inset outline
  (`focus-visible:-outline-offset-2`), never an outer ring that the container clips.
- Focus: every interactive element has a visible accent `focus-visible` ring (`ring-ring/85`, 3 px).

## Status colours

| Status | Tone | Light text on tint | Dark text on tint |
|---|---|---|---|
| Available | success (green `#34C759` tint) | `#1B7A34` | `#6EE08B` |
| Booked | neutral (`secondary`) | label | label |
| Error, destructive | danger (red `#FF3B30` tint) | `#C4170C` | `#FF7A72` |

Use `bg-success-bg text-success`, `bg-warning-bg text-warning`, `bg-danger-bg text-danger` or `<StatusBadge>`.

## Contrast (WCAG AA)

Normal text 4.5:1, graphics and focus rings 3:1, checked in both themes (key pairs): label on glass 12.4 / 9.7;
glass secondary on glass 6.1 / 5.3; secondary on card 5.1 / 6.6; white on `#0071E3` 4.7; link on canvas 5.1 / 6.2;
status pills 4.7-6.6; focus ring 3.7 / 4.3. When you add a colour pair, compute it.

## Do and don't

- Do use tokens and the utilities above; do keep both themes and the reduced-transparency fallback working.
- Do use pill buttons, grouped lists, large titles, labels above bordered inputs.
- Don't add glass to content, or nest more than one glass layer in another.
- Don't hide or restyle scrollbars ad hoc; don't use outer rings on packed items.
- Don't use User/Customer naming: Host, Guest, Slot, Booking only.
- Don't use raw colours, `text-gray-*`, `bg-white`, or `dark:` colour overrides when a token exists.
