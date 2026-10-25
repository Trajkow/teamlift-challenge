# Phase 3: Optional Extra (AI Confirmation Message)

**Status: ✅ done** · Depends on: 1, 2 · Unblocks: 4

## Goal
After a booking, the guest sees a short, friendly confirmation that an LLM writes for them, along the lines of "See
you Tuesday at 10:30, Ana! Bring your questions about...". This uses Gemini through the Google AI Studio free tier,
as the brief suggests.

## Prerequisites
- **Ask the user** for a `GEMINI_API_KEY` from https://aistudio.google.com/apikey and put it in `backend/.env`. Never
  commit it.
- Approved package: `@google/genai` (the official Google Gen AI JS SDK). Check its current API in
  `node_modules/@google/genai` after installing; don't write it from memory.

## Decisions
- **Make it a separate endpoint, `POST /api/bookings/:id/confirmation-message`.** Don't build it into the booking
  request. Booking stays fast and never fails because of the LLM, and the brief asks for "one simple backend
  endpoint that calls an LLM".
- **Generate the message once.** The first call stores it in `booking.confirmation_message`, and later calls return
  the stored text. That keeps free-tier quota safe and makes refreshes cheap.
- **Fall back to a template.** If there's no key, an error, a timeout (5 s, via `AbortController`) or empty output,
  return a template ("You're booked for {day} at {time}, {name}. See you then!") with `source: 'template'`. Never
  return a 500 because of the LLM.
- **Model:** `GEMINI_MODEL` env var. Default it to the current free-tier Flash model listed in AI Studio, check it
  works with one call, and write down which model you used in the Handoff notes and the README.
- **Prompt safety:** the guest's name and note are untrusted. Put them in a clearly delimited data block, cap their
  length, and tell the model to treat them only as data. Ask for plain text of at most 2 sentences with no links.
  Strip any markdown from the output and cap it at 300 characters. The frontend renders it as text, never as HTML.
- Rate limit the endpoint at 10/min per IP.

## Tasks

### 3.1 `ai` module (`src/modules/ai/`)
- `ai.module.ts` and `confirmation-message.service.ts` with `generate(input: { name; startsAt; durationMinutes; note; timeZone; hostName })`
  that returns `Promise<string | null>`. It returns `null` on any failure and logs a warning with no PII.
- `prompt.ts` holds a pure `buildPrompt(input)` function, with a unit spec that checks the delimiters and truncation.
- `slots` imports `AiModule`. The service is injected and isn't imported from inside the module.

### 3.2 Endpoint
- `BookingsController.confirmationMessage(id)`:
  - 404 if the booking is missing;
  - if `confirmationMessage` is already set, return it with `source: 'ai'`;
  - otherwise generate, store the result only if the AI succeeded, and fall back to the template.
- e2e: with `GEMINI_API_KEY` unset, the response is 200 with `source: 'template'` and the message contains the guest's
  name. Use a unit spec with a mocked client for the AI path. Don't make real LLM calls in tests.

### 3.3 Frontend
- `features/booking/hooks.ts` adds `useConfirmationMessage(bookingId)`, a `useMutation` fired once on the success
  screen.
- `booking-success.tsx` shows a `Skeleton` with two text lines while it loads, then the message in a quote-style
  card. Show a tiny "Written by AI" caption with a sparkle icon when `source === 'ai'`.

## Verification
```bash
cd backend && npm test && npm run test:e2e
cd ../frontend && npm run typecheck
```
Manual checks:
- with a real key, book a slot and see the AI message;
- remove the key, book again, and see the template.

## Commits
- `feat(ai): add gemini confirmation message with template fallback`
- `feat(booking): show ai confirmation on the success screen`

## Out of scope
Sending the message by email, and streaming.

## Handoff notes
- **Built:** `backend/src/modules/ai/` (`prompt.ts`, `confirmation-message.service.ts`, `ai.module.ts`), endpoint
  `POST /api/bookings/:id/confirmation-message` (`BookingsController` in `slots.controller.ts`, logic in
  `SlotsService.confirmationMessage`), rate limit 10/min (`RateLimit.confirmation()`, env
  `RATE_LIMIT_CONFIRMATION_PER_MIN`). Frontend: `useConfirmationMessage` hook, quote card with skeleton and a
  "Written by AI" caption in `booking-success.tsx`. If the request errors, the card is simply hidden.
- **Behaviour:** the first successful AI text is stored in `booking.confirmation_message` (first write wins) and
  later calls return it with `source: 'ai'`. Any failure (no key, error, 5 s timeout, empty output) returns the
  template with `source: 'template'` and stores nothing. Output is stripped of markdown and links, capped at 300 chars.
- **Model:** `GEMINI_MODEL`, default `gemini-flash-latest` (the alias used in the SDK docs). **Unverified:** no API
  key was available, so neither the model name nor a live call was checked, and average latency is unknown. Add
  `GEMINI_API_KEY` to `backend/.env`, book a slot and check the message says `source: 'ai'`. If the alias is
  rejected, set `GEMINI_MODEL` to a current free-tier Flash model from AI Studio. Mention the model in the README (Phase 5).
- **Verified:** unit tests with a mocked client (success, no key, error, empty, timeout), prompt spec, e2e for the
  template fallback, stored-message path and 404, and a live backend on port 3200 returning the template.
- **Polish:** `SLOT_OVERLAP` now has a human message; the host time column no longer wraps; `INVALID_TIME` is in the
  error table and has a friendly frontend message.
