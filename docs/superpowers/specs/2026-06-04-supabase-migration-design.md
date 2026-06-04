# Supabase Migration — Design Spec

**Date:** 2026-06-04
**Project:** sommarbukt-boats-v2 (Next.js 14 PWA, boat rental management)
**Status:** Approved design — ready for implementation planning

---

## 1. Background & Motivation

The app currently stores **all data in `localStorage` on a single iPad** (`lib/storage.ts`,
`lib/safe-storage.ts`). This causes:

- **No backup / single point of failure** — a lost or wiped iPad means total data loss.
- **No multi-device access** — rentals exist only on one device; staff can't share a fleet view.
- **Storage ceiling** — ID photos, licence photos, damage photos and signatures are stored as
  base64 inside `localStorage` (~5–10 MB cap). The code already handles `QuotaExceededError`
  ("The iPad storage is full") — i.e. the wall is expected.
- **Unprotected PII** — passport/ID photos and signatures sit in plaintext `localStorage`,
  despite the rental contract promising GDPR compliance.

We migrate to **Supabase** (Postgres + Storage + Auth) to make the app durable, backed up,
multi-device, and secure.

## 2. Requirements (decided)

| Decision | Choice |
|---|---|
| Existing data | **Disposable** — start fresh on Supabase, no import tooling |
| Access control | **Single shared login** (one staff account) |
| Connectivity | **Usually online** — no offline sync needed |
| Scope | **Full reliable setup** — DB + photo storage + auth + RLS + secured email route |
| Hosting | Vercel (GitHub: `molt2000/sommarbukt-boats-v2`) |
| Architecture | **Approach A** — direct client access with RLS (anon key in browser) |

**Out of scope (YAGNI):** offline sync, per-user accounts, realtime live updates,
server-side PDF archival, data-import tooling. Each can be added later without rework.

## 3. Architecture

```
iPad (Next.js PWA, client components)
        │  @supabase/supabase-js (anon key)
        │   - shared login session
        │   - read/write rentals, boats, damages
        │   - upload/fetch photos via signed URLs
        ▼
┌─────────────────────────────────────────┐
│ Supabase                                  │
│  • Auth        → shared staff login       │
│  • Postgres    → boats, rentals, damages  │
│  • Storage     → id-photos, damage-photos,│
│                  signatures (all private) │
│  • RLS         → authenticated-only       │
└─────────────────────────────────────────┘
        ▲  service-role key (server only)
        │
Next.js /api/send-email → verifies session, sends PDF via SMTP
```

**Core idea:** `lib/storage.ts` keeps its function names but becomes **async** and talks to
Supabase instead of `localStorage`. The page components already load data in `useEffect` with
try/catch, so they adapt with minimal change (add `await` + loading state).

## 4. Database Schema

```sql
-- FLEET
create table boats (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  registration  text not null default '',
  available     boolean not null default true,
  created_at    timestamptz not null default now()
);

-- RENTALS
create table rentals (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  status          text not null default 'active'
                    check (status in ('active','completed','cancelled')),

  -- guest grab-bag: name, phone, email, nationality, idNumber,
  --   passengerCount, hasLicence, licenceNumber, bornBefore1980
  guest           jsonb not null default '{}',

  -- photo references (Storage paths, NOT base64)
  id_photo_path        text,
  id_photo_back_path   text,
  licence_photo_path   text,
  signature_path       text,

  boat_id         uuid references boats(id),
  boat_name       text not null default '',
  checkout_date   timestamptz,
  return_date     timestamptz,
  actual_return   timestamptz,

  safety_checklist jsonb not null default '{}',
  checkout_fuel    text not null default 'Full',
  checkin_fuel     text not null default '',

  -- payment grab-bag: rentalFee, depositAmount, depositReceived,
  --   depositReturned, depositDeduction
  payment         jsonb not null default '{}'
);

-- DAMAGES (own table — queried per-boat across rentals)
create table damages (
  id           uuid primary key default gen_random_uuid(),
  boat_id      uuid references boats(id),
  rental_id    uuid references rentals(id) on delete cascade,
  phase        text not null check (phase in ('checkout','checkin')),
  view         text not null check (view in ('stb','bb','front','rear','top')),
  px           real not null,
  py           real not null,
  description  text not null default '',
  photo_paths  text[] not null default '{}',   -- Storage paths
  repaired_at  timestamptz,                     -- NULL = active; set = repaired/hidden
  created_at   timestamptz not null default now()
);

-- Enforce "one active rental per boat" at the DB level
create unique index one_active_rental_per_boat
  on rentals (boat_id) where status = 'active';
```

### Schema decisions

1. **Damages are their own table.** Today they're embedded in each rental *and* duplicated into
   a separate `sb_boat_damages` localStorage key so pre-existing damage shows on the next rental.
   A real table keyed by `boat_id` makes "show this boat's history" a trivial query and removes
   the duplication.
2. **`guest` and `payment` as JSONB** — grab-bags only read/written together. Queryable fields
   (status, dates, boat) are real columns.
3. **Unique partial index** enforces one active rental per boat at the DB level — stronger than
   the old in-memory check that only worked on one device.
4. **Unifies the duplicate `Boat` type** (`lib/types.ts` vs `app/config/page.tsx`) into one shape.

### Damage lifecycle

- A boat's active damage = `damages` rows for that `boat_id` where `repaired_at is null`.
  These show on new rentals as white "!" markers.
- New damage added during the current rental shows as red markers (full delete-before-save).
- **Marking a damage repaired** sets `repaired_at` (soft delete): it stops appearing on new
  rentals but remains visible on the rental that documented it. Signed PDFs are unaffected either way.
- Damages are managed **only inside the handover/return wizard** (no separate fleet screen).
  Change vs today: existing white markers gain a **"Mark as repaired"** action (today: view-only).

## 5. Photo & Signature Storage

- **Three private buckets:** `id-photos`, `damage-photos`, `signatures`.
- **Upload flow:** the iPad already compresses to a JPEG data URL (`lib/image.ts`, unchanged).
  New `lib/upload.ts` converts the data URL to a Blob, uploads to the right bucket, and returns
  the **storage path** (e.g. `id-photos/<rental-id>/front.jpg`). The path is stored in the DB —
  not the base64.
- **Display:** private buckets need a short-lived **signed URL** (`getSignedUrl(path)`). Detail /
  damage views resolve paths → signed URLs on load.
- **PDF generation:** jsPDF needs the bytes embedded, so before generating a PDF we fetch the
  photos from Storage back into base64 and feed them to the existing `lib/pdf.ts` (layout
  unchanged). PDF generation stays client-side.
- **Cleanup:** deleting a rental deletes its photos from the buckets; `on delete cascade` removes
  its damage rows.

Net effect: each rental row goes from several MB to a few KB; no storage ceiling.

## 6. Auth & Security

**Shared login**
- Supabase Auth, one email/password account (e.g. `boats@sommarbukt.com`).
- Login page + middleware gate: unauthenticated → `/login`. PWA session persists on the iPad.

**Row Level Security**
- RLS enabled on `boats`, `rentals`, `damages`. One policy each: authenticated users full access;
  anonymous denied.
- Storage buckets private with the same rule — ID photos/signatures never publicly reachable
  (the GDPR-relevant fix).

**Email route** (`app/api/send-email/route.ts`)
- Replace the `NEXT_PUBLIC_API_TOKEN` check (ships to browser, not secret) with **server-side
  session verification** via the server Supabase client. No session → 401. Existing input
  validation/sanitization stays. Remove `NEXT_PUBLIC_API_TOKEN`.

**RLS / Storage policy SQL**

```sql
alter table boats   enable row level security;
alter table rentals enable row level security;
alter table damages enable row level security;

create policy "auth full access" on boats
  for all to authenticated using (true) with check (true);
create policy "auth full access" on rentals
  for all to authenticated using (true) with check (true);
create policy "auth full access" on damages
  for all to authenticated using (true) with check (true);

-- Storage: authenticated-only access to the three private buckets
create policy "auth read"   on storage.objects for select to authenticated
  using (bucket_id in ('id-photos','damage-photos','signatures'));
create policy "auth insert" on storage.objects for insert to authenticated
  with check (bucket_id in ('id-photos','damage-photos','signatures'));
create policy "auth delete" on storage.objects for delete to authenticated
  using (bucket_id in ('id-photos','damage-photos','signatures'));
```

**Environment variables** (`.env.local` + Vercel):

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...        # safe to expose; RLS protects data
SUPABASE_SERVICE_ROLE_KEY=...            # server only (email route)
SMTP_HOST=smtps.udag.de
SMTP_PORT=465
SMTP_USER=boats@sommarbukt.com
SMTP_PASS=...
# NEXT_PUBLIC_API_TOKEN removed
```

## 7. Code Changes

**New files**
- `lib/supabase/client.ts` — browser client (anon key)
- `lib/supabase/server.ts` — server client (service role) for the email route
- `lib/upload.ts` — `uploadPhoto(dataUrl, bucket, path)`, `getSignedUrl(path)`, `deletePhotos(paths)`
- `app/login/page.tsx` — shared-account login
- `middleware.ts` — redirect unauthenticated users to `/login`

**Rewritten**
- `lib/storage.ts` — same function names, now **async**, Supabase-backed:
  `getBoats`, `getRentals`, `getRental`, `saveRental`, `deleteRental`,
  `getBoatDamages` (filters `repaired_at is null`), plus `markDamageRepaired(id)`.
  Maps snake_case columns ↔ existing camelCase types in one place.

**Edited (small)**
- `app/page.tsx`, `app/rental/[id]/page.tsx`, `app/rental/[id]/return/page.tsx`,
  `app/rental/new/page.tsx`, `app/config/page.tsx` — add `await` + loading states.
- `components/damage-report.tsx` — upload photos to Storage instead of base64; add
  "Mark as repaired" on existing markers.
- `lib/pdf.ts` — accept resolved image bytes (fetch from Storage before generating); layout untouched.
- `app/api/send-email/route.ts` — session verification instead of token.

**Deleted**
- `lib/safe-storage.ts` and the localStorage quota error handling.

**Type cleanup**
- Unify `Boat` into one type (`id`, `name`, `registration`, `available`).
- Split `Damage` from `Rental` to mirror the table; add `repairedAt`.

## 8. Supabase Setup Walkthrough (manual, account already exists)

Do these dashboard steps once; the rest is code.

1. **Create the project**
   - supabase.com → Dashboard → **New project**.
   - Name `sommarbukt-boats`; pick a strong DB password (save it); region **EU (Frankfurt)**
     (closest to Norway, GDPR-friendly). Wait for provisioning (~2 min).

2. **Run the schema**
   - Left sidebar → **SQL Editor** → **New query**.
   - Paste the SQL from **§4 (schema)**, run it. Confirm `boats`, `rentals`, `damages` appear
     under **Table Editor**.

3. **Seed the two boats**
   - SQL Editor, run:
     ```sql
     insert into boats (name) values ('Tind'), ('Nordlys');
     ```

4. **Create the storage buckets**
   - Left sidebar → **Storage** → **New bucket**.
   - Create three buckets, each with **Public = OFF (private)**:
     `id-photos`, `damage-photos`, `signatures`.

5. **Apply RLS & storage policies**
   - SQL Editor → paste and run the policy SQL from **§6**.

6. **Create the shared staff login**
   - Left sidebar → **Authentication** → **Users** → **Add user** → **Create new user**.
   - Email `boats@sommarbukt.com`, set a password, tick **Auto Confirm User**.
   - (Optional but recommended) **Authentication → Providers → Email**: turn **off**
     "Allow new users to sign up" so only this account can exist.

7. **Grab the keys**
   - Left sidebar → **Project Settings → API**. Copy:
     - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
     - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (keep secret)

8. **Add env vars**
   - Local: put them in `.env.local` (see **§6**).
   - Vercel: Project → **Settings → Environment Variables** → add all four Supabase/SMTP entries
     for Production (and Preview). Redeploy.

After step 8, hand off to the code implementation.

## 9. Rollout Sequence

1. Supabase setup (§8) — project, schema, buckets, account, env vars.
2. Supabase clients + unified types (`lib/supabase/*`).
3. Photo storage (`lib/upload.ts`) — verify upload + signed-URL round-trip.
4. `lib/storage.ts` rewrite (async, Supabase-backed) + `markDamageRepaired`.
5. Wire pages: `await`/loading states; `damage-report.tsx` uploads + repaired action; `pdf.ts` fetch bytes.
6. Auth: login page, middleware gate, session persistence.
7. Secure email route: session verification; drop `NEXT_PUBLIC_API_TOKEN`.
8. Cleanup: delete `safe-storage.ts` and quota handling; remove dead code.

## 10. Testing (end-to-end on the running app)

- **After step 3:** a test upload appears in the bucket and renders via signed URL.
- **New-rental flow:** ID photos + damage photos + signature save; PDF generates with images;
  `rentals` row is small (KB not MB).
- **Return flow:** damages added, deposit resolved, status → `completed`, return PDF correct.
- **Repaired flow:** mark an existing damage repaired → gone from a *new* rental, still on the old one.
- **Multi-device:** second device logs in and sees the same rentals.
- **One-active-per-boat:** starting a second active rental on a boat is blocked by the unique index.
- **Auth:** logged out → redirected to login; email route returns 401 without a session.
