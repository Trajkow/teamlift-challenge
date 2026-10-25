# Slot

A small scheduling app: one host publishes time slots, and anyone can book one with their name and email. A slot can
never be booked twice. Built for the [TeamLift internship challenge](teamlift_internship_challenge.md).

> Full README (setup, design notes, deployment) comes in a later phase.

## Run locally

Requires Node 24, Docker and npm.

```bash
# Backend (http://localhost:3000, Postgres on :5433 via Docker)
cd backend
cp .env.example .env
npm install
npm run db:generate
npm run start:dev

# Frontend (http://localhost:3001, proxies /api to the backend)
cd frontend
cp .env.example .env.local
npm install
npm run dev
```
