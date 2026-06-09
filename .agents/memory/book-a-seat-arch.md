---
name: Book a Seat — architecture decisions
description: Non-obvious decisions made during the initial build of the workspace management system
---

## JWT auth stored in localStorage
Auth token stored in `localStorage` under key `bas_token`, read by `setAuthTokenGetter` in `AuthContext.tsx`. Bearer token attached to every API call via the custom-fetch module. Works correctly with the shared Replit reverse proxy (no httpOnly cookie conflicts).

**Why:** Single-SPA on same domain served through proxy — no cross-origin issues, and simpler than cookie/session approach.

## Analytics router double-mounted
`analyticsRouter` is mounted at both `/api/analytics` and `/api/dashboard` in `routes/index.ts`. This is intentional — the OpenAPI spec exposes `/api/dashboard/summary` (used by the dashboard hook `useGetDashboardSummary`) and `/api/analytics/overview` (used by the admin analytics page).

**Why:** Orval codegen creates two separate hooks from two different OpenAPI paths; the simplest fix is mounting the same router twice rather than duplicating route handlers.

## Database seeded on first API boot
`seedDatabase()` is called in the `app.listen` callback in `index.ts`. The seed function checks `usersTable` row count — if > 0, it skips. Safe to deploy without manual seed step.

**Why:** Zero-config onboarding; seed accounts documented in replit.md.

## AuthContext import path
`User` type and `setAuthTokenGetter` should both be imported from `@workspace/api-client-react` (the package barrel), NOT from deep paths like `@workspace/api-client-react/src/generated/api.schemas` or `@workspace/api-client-react/src/custom-fetch`. The barrel exports all of these.

**Why:** Direct path imports broke when the design subagent scaffolded the AuthContext before understanding the barrel export structure.
