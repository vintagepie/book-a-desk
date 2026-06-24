# Supabase backend for Book a Desk

This folder holds the Supabase-ready database migration for the office admin backend.

## What is included

- Core tables for users, desks, desk bookings, meeting rooms, meeting room bookings, notifications, and maintenance logs.
- Updated-at triggers for mutable tables.
- Indexes for the common dashboard and booking lookups.
- Row level security enabled on exposed tables.
- Analytics-friendly reporting views for:
  - office dashboard overview
  - desk utilization trend
  - department attendance
  - meeting room utilization
  - weekly booking trend
  - recent activity feed
  - maintenance and user analytics
  - export-ready report views

## How to use

Apply the migration in `supabase/migrations/20260623000000_office_admin_backend.sql` to a Supabase project, then point the server's `DATABASE_URL` at the Supabase Postgres connection string.

The API server can keep running as a thin application layer while the database lives in Supabase.

