# Book a Seat — Workspace & Meeting Room Management

A full-stack enterprise workspace management system for booking desks, reserving meeting rooms, QR check-in, notifications, analytics, and maintenance management.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, routed via `/api`)
- `pnpm --filter @workspace/book-a-seat run dev` — run the frontend (port 19979, routed via `/`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Frontend: React + Vite, TailwindCSS v4, shadcn/ui components, Wouter routing
- Auth: JWT (jsonwebtoken + bcryptjs), stored in localStorage, attached via Bearer header
- Build: esbuild (CJS bundle for API)

## Where things live

- `lib/db/src/schema/` — Drizzle table schemas (users, desks, desk_bookings, meeting_rooms, meeting_room_bookings, notifications, maintenance_logs)
- `lib/api-spec/openapi.yaml` — OpenAPI 3.0 spec (source of truth for API contract)
- `lib/api-client-react/src/generated/` — generated React Query hooks and Zod schemas (from codegen)
- `artifacts/api-server/src/routes/` — Express route handlers per resource
- `artifacts/api-server/src/lib/seed.ts` — seed data (auto-runs on first boot)
- `artifacts/api-server/src/lib/cron.ts` — cron jobs (9:45 AM booking expiry, 8:30 AM reminders)
- `artifacts/book-a-seat/src/pages/` — React pages (dashboard, desks, meeting-rooms, admin/*, etc.)
- `artifacts/book-a-seat/src/contexts/AuthContext.tsx` — JWT auth context

## Architecture decisions

- Contract-first: OpenAPI spec drives all API shape; Orval generates typed hooks + Zod schemas
- Monorepo with shared `lib/db` and `lib/api-client-react` libs; artifacts are consumers
- JWT stored in localStorage (not httpOnly cookies) — fits single-SPA with same-domain proxy
- Analytics mounted twice: `/api/analytics/*` and `/api/dashboard/*` for dashboard summary
- DB seeded on first API boot (idempotent check: skips if users table non-empty)

## Product

**Roles:** Employee, Team Lead, Admin

**Features:**
- Dashboard with real-time metrics
- Desk browsing & booking by date with availability filtering
- QR code check-in simulation
- Meeting room listing and time-slot booking
- My bookings & my meetings management with cancellation
- Notification center with unread count badge
- Admin: desk management + maintenance tracking
- Admin: meeting room schedule overview
- Admin: user role management
- Admin: analytics overview (occupancy, check-in rate, utilization)
- Cron: auto-expire unchecked bookings at 9:45 AM; send reminders at 8:30 AM

## Seed Accounts

| Email | Password | Role |
|---|---|---|
| admin@company.com | admin123 | Admin |
| lead@company.com | lead123 | Team Lead |
| jane@company.com | pass123 | Employee |
| john@company.com | pass123 | Employee |

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Run `pnpm --filter @workspace/api-spec run codegen` after any OpenAPI spec change
- Run `pnpm --filter @workspace/db run push` after schema changes
- Analytics router is mounted at both `/api/analytics` and `/api/dashboard` in routes/index.ts
- JWT secret defaults to a hardcoded fallback if `JWT_SECRET` env is not set (set it in production)

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
