# Phase 5: README, QA and Submission

**Status: ⏳ todo** · Depends on: 4

## Goal
Turn the build into a submission that scores on every evaluation criterion: UI, a flow that works end to end,
readable code, use of AI tools, and the author's own choices.

## Tasks

### 5.1 README.md (root)
Keep it short and easy to scan. Use these sections:
1. **Slot**: one line on what it is and the theme. Then the live link, a screenshot or GIF of the guest and host
   views (save it in `docs/`), and the video link if there is one.
2. **What it does**: the brief's 4 requirements, each with where to find it in the UI.
3. **How it works**:
   - stack (NestJS + Prisma + Postgres, Next.js + React + TS + shadcn/ui + TanStack Query, Gemini);
   - a small diagram (browser → Vercel/Next proxy → Render/Nest → Neon);
   - **how double booking is prevented**: `UNIQUE(slot_id)` plus the overlap exclusion constraint, the
     20-parallel-request test, and why the guarantee lives in the database rather than the app.
4. **Run it locally**:
   - prerequisites (Node, Docker);
   - backend: `cp .env.example .env`, `npm install`, `npm run db:migrate`, `npm run start:dev`;
   - frontend: `npm install`, `npm run dev`;
   - tests;
   - optional `GEMINI_API_KEY`.
5. **Choices I made**:
   - no accounts, plus the optional host key;
   - one time zone;
   - booked slots stay visible;
   - the AI message is a separate endpoint with a template fallback.
6. **AI tools I used**: an honest account. Claude Code ran agents from these phase plans (`docs/plans/`) with
   `AGENTS.md` as their rules. Say what the author reviewed or changed by hand, and where AI got something wrong and
   how it was caught. **Ask the user to write or confirm this section**: interviewers will ask about it, and it must
   be true.
7. **With more time**:
   - Google Calendar conflict check;
   - real host auth;
   - email confirmations;
   - guest self-cancel via a signed link;
   - recurring weekly availability;
   - Playwright tests in CI.

### 5.2 Final QA on the live link
- Fresh incognito window, desktop and phone.
- Both themes.
- Slow first load after Render has gone to sleep.
- The double-booking race: two tabs, submit both.
- No console errors.
- Check the README links work.

### 5.3 Submission (the user sends it)
Draft this email for the user. **Never send it on their behalf.**
- To: reply to the TeamLift email, or `support@teamlift.co`
- Subject: `TeamLift Internship Challenge: <Full Name>`
- Body: the live link, the GitHub repo link, the video link (optional), the host key if one is set, and a 2-line
  summary.

### 5.4 Video script (optional, at most 2 minutes)
- 0:00 to 0:15: what it is and the theme.
- 0:15 to 0:45: host creates 4 back-to-back slots.
- 0:45 to 1:15: guest books one, sees the AI confirmation and downloads the `.ics`.
- 1:15 to 1:35: a second tab tries the same slot and is refused. Explain the DB constraint.
- 1:35 to 2:00: how AI tools were used (phase plans plus agents), and what's next.

## Commits
- `docs: write readme with setup, choices and ai usage`

## Handoff notes
_(fill in: submitted on, links)_
