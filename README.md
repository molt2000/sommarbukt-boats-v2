# Sommarbukt Boat Rental

iPad-first PWA for managing boat rentals (handover + return), built with Next.js 14 and backed by Supabase (Postgres, Storage, Auth).

## Setup

1. **Supabase** — create a project (region EU/Frankfurt), then follow the setup walkthrough in
   `docs/superpowers/specs/2026-06-04-supabase-migration-design.md` §8: run the schema SQL,
   create the three private storage buckets (`id-photos`, `damage-photos`, `signatures`),
   apply the RLS + storage policies, seed the boats, and create the shared staff login.

2. **Environment** — copy `.env.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publishable key)
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` (for emailing PDFs)

   (`SUPABASE_SERVICE_ROLE_KEY` is not required — auth uses the anon key + session cookie.)

   Mirror the same variables in Vercel → Settings → Environment Variables (Production + Preview).

## Develop

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # unit tests (Vitest)
npm run build    # production build
```

## How it works

- All data lives in Supabase Postgres (`boats`, `rentals`, `damages`). Photos and signatures
  live in private Supabase Storage buckets, referenced by path and shown via signed URLs.
- The whole app is behind a shared staff login (Supabase Auth); middleware redirects
  unauthenticated requests to `/login`. Row Level Security restricts data to authenticated users.
- PDFs (handover agreement + return report) are generated client-side with jsPDF and can be
  emailed to the guest via the `/api/send-email` route (which verifies the session server-side).
