# Supabase Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the localStorage data layer with Supabase (Postgres + Storage + Auth) so the boat-rental app is durable, backed up, multi-device, and secure behind a shared login.

**Architecture:** Direct client access (Approach A) — the browser uses the Supabase anon key, protected by Row Level Security. `lib/storage.ts` keeps its function names but becomes async and Supabase-backed. Photos move from base64-in-localStorage to private Storage buckets, referenced by path. The email route verifies the Supabase session server-side.

**Tech Stack:** Next.js 14 (App Router), `@supabase/supabase-js`, `@supabase/ssr`, TypeScript, Vitest (new, for unit-testing pure mappers).

**Reference spec:** `docs/superpowers/specs/2026-06-04-supabase-migration-design.md`

---

## Prerequisite (manual, by the user — not a code task)

Supabase dashboard setup per spec §8 must be done before Task 7 can be verified end-to-end:
project created (EU/Frankfurt), schema SQL run, two boats seeded, three private buckets
(`id-photos`, `damage-photos`, `signatures`), RLS + storage policies applied, shared login user
created, keys copied. Tasks 1–6 can be built before this; they only need the env var *names*.

---

## File Structure

**New**
- `lib/supabase/client.ts` — browser client (`createBrowserClient`)
- `lib/supabase/server.ts` — server client for route handlers (`createServerClient` over cookies)
- `lib/supabase/middleware.ts` — `updateSession` helper for the Next.js middleware
- `middleware.ts` — root middleware that refreshes session + gates routes
- `lib/mappers.ts` — pure snake_case↔camelCase row mappers (unit-tested)
- `lib/mappers.test.ts` — Vitest unit tests for mappers
- `lib/upload.ts` — `uploadDataUrl`, `getSignedUrl`, `deletePaths`, `dataUrlFromPath`
- `app/login/page.tsx` — shared-account login
- `vitest.config.ts` — Vitest config

**Rewritten**
- `lib/storage.ts` — async, Supabase-backed; same function names + `markDamageRepaired`
- `lib/types.ts` — unified `Boat`, `Damage` (with `repairedAt`, `photoPaths`); `Rental` photo fields become paths

**Edited**
- `app/page.tsx`, `app/rental/[id]/page.tsx`, `app/rental/[id]/return/page.tsx`,
  `app/rental/new/page.tsx`, `app/config/page.tsx` — await + loading states
- `components/damage-report.tsx` — upload photos to Storage; "Mark as repaired"
- `lib/pdf.ts` — accept resolved image bytes
- `app/api/send-email/route.ts` — session verification instead of token
- `.env.example`, `package.json`

**Deleted**
- `lib/safe-storage.ts` and its references

---

## Task 1: Install dependencies and configure Vitest

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Modify: `.env.example`

- [ ] **Step 1: Install runtime + dev dependencies**

Run:
```bash
npm install @supabase/supabase-js @supabase/ssr
npm install -D vitest
```
Expected: both complete; `package.json` gains the three packages.

- [ ] **Step 2: Add the test script**

In `package.json` `"scripts"`, add:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
});
```

- [ ] **Step 4: Update `.env.example`**

Replace the file contents with:
```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

SMTP_HOST=smtps.udag.de
SMTP_PORT=465
SMTP_USER=boats@sommarbukt.com
SMTP_PASS=changeme
```

- [ ] **Step 5: Verify the test runner works**

Run: `npm test`
Expected: exits 0 with "No test files found" (no tests yet) — confirms Vitest is wired.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts .env.example
git commit -m "chore: add supabase + vitest dependencies and env template"
```

---

## Task 2: Unify domain types

**Files:**
- Modify: `lib/types.ts`

- [ ] **Step 1: Replace the `Rental`, `Damage`, `Boat` definitions**

In `lib/types.ts`, replace the `Rental` interface's four base64 photo fields and the `Damage`
and `Boat` interfaces. The `Rental` interface keeps `checkoutDamages`/`checkinDamages` for
in-memory wizard use (the storage layer maps them to/from the `damages` table).

Replace:
```ts
  idPhotoData: string; // base64
  idPhotoDataBack: string; // base64 - back of ID card
```
with:
```ts
  idPhotoPath: string;     // Storage path in id-photos bucket
  idPhotoBackPath: string; // Storage path in id-photos bucket
```

Replace:
```ts
  licencePhotoData: string; // base64
```
with:
```ts
  licencePhotoPath: string; // Storage path in id-photos bucket
```

Replace:
```ts
  signatureData: string; // base64
```
with:
```ts
  signaturePath: string; // Storage path in signatures bucket
```

Replace the `Damage` interface with:
```ts
export interface Damage {
  id: string;
  view: 'stb' | 'bb' | 'front' | 'rear' | 'top';
  px: number;
  py: number;
  photoPaths: string[];      // Storage paths in damage-photos bucket
  desc: string;
  date: number;              // timestamp
  repairedAt: string | null; // ISO string when marked repaired, else null
}
```

Replace the `Boat` interface with:
```ts
export interface Boat {
  id: string;
  name: string;
  registration: string;
  available: boolean;
}
```

- [ ] **Step 2: Update `newRental()`**

In `newRental()` replace the photo/signature field initializers:
```ts
    idPhotoData: "", idPhotoDataBack: "", passengerCount: 1, hasLicence: false, licenceNumber: "", licencePhotoData: "",
```
with:
```ts
    idPhotoPath: "", idPhotoBackPath: "", passengerCount: 1, hasLicence: false, licenceNumber: "", licencePhotoPath: "",
```
and replace:
```ts
    signatureData: "",
```
with:
```ts
    signaturePath: "",
```

- [ ] **Step 3: Verify it type-checks (will surface call sites — expected)**

Run: `npx tsc --noEmit`
Expected: errors ONLY in files that reference the renamed fields (`pdf.ts`, the pages,
`damage-report.tsx`, `storage.ts`, `config/page.tsx`). These are fixed in later tasks. Confirm
there are no errors *inside* `lib/types.ts` itself.

- [ ] **Step 4: Commit**

```bash
git add lib/types.ts
git commit -m "refactor: unify Boat/Damage types and switch photo fields to Storage paths"
```

---

## Task 3: Row mappers (TDD)

Pure functions converting Supabase rows ↔ domain objects. No I/O, fully unit-testable.

**Files:**
- Create: `lib/mappers.ts`
- Test: `lib/mappers.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/mappers.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { rowToBoat, rowToDamage, damageToRow, rowToRental, rentalToRow } from "./mappers";
import type { Rental, Damage } from "./types";

describe("rowToBoat", () => {
  it("maps a boat row to a Boat", () => {
    expect(rowToBoat({ id: "b1", name: "Tind", registration: "AB-1", available: true }))
      .toEqual({ id: "b1", name: "Tind", registration: "AB-1", available: true });
  });
  it("defaults missing registration/available", () => {
    expect(rowToBoat({ id: "b1", name: "Tind", registration: null, available: null }))
      .toEqual({ id: "b1", name: "Tind", registration: "", available: true });
  });
});

describe("damage <-> row", () => {
  const damage: Damage = {
    id: "d1", view: "stb", px: 10.5, py: 20.25,
    photoPaths: ["damage-photos/r1/d1-0.jpg"], desc: "scratch",
    date: 1700000000000, repairedAt: null,
  };
  it("damageToRow flattens for the damages table", () => {
    expect(damageToRow(damage, "r1", "b1", "checkout")).toEqual({
      id: "d1", rental_id: "r1", boat_id: "b1", phase: "checkout",
      view: "stb", px: 10.5, py: 20.25,
      photo_paths: ["damage-photos/r1/d1-0.jpg"], description: "scratch",
      repaired_at: null, created_at: new Date(1700000000000).toISOString(),
    });
  });
  it("rowToDamage round-trips", () => {
    const row = damageToRow(damage, "r1", "b1", "checkout");
    expect(rowToDamage(row)).toEqual(damage);
  });
  it("rowToDamage defaults null photo_paths to empty array", () => {
    const row = { ...damageToRow(damage, "r1", "b1", "checkout"), photo_paths: null };
    expect(rowToDamage(row).photoPaths).toEqual([]);
  });
});

describe("rental <-> row", () => {
  const rental: Rental = {
    id: "r1", createdAt: "2026-06-04T10:00:00.000Z", status: "active",
    guestName: "Jane", guestPhone: "+49", guestEmail: "j@e.com",
    nationality: "DE", idNumber: "X1", idPhotoPath: "id-photos/r1/front.jpg",
    idPhotoBackPath: "", passengerCount: 2, hasLicence: true, licenceNumber: "L1",
    licencePhotoPath: "", bornBefore1980: false,
    boatId: "b1", boatName: "Tind",
    checkoutDate: "2026-06-04T11:00:00.000Z", returnDate: "2026-06-05T11:00:00.000Z",
    actualReturn: "", safetyChecklist: { "Key handed over": true },
    checkoutDamages: [], checkinDamages: [],
    checkoutFuel: "Full", checkinFuel: "",
    rentalFee: "3100 NOK", depositAmount: "5000 NOK", depositReceived: true,
    depositReturned: false, depositDeduction: "", signaturePath: "signatures/r1.png",
  };
  it("rentalToRow groups guest/payment and excludes damages", () => {
    const row = rentalToRow(rental);
    expect(row.id).toBe("r1");
    expect(row.status).toBe("active");
    expect(row.boat_id).toBe("b1");
    expect(row.guest).toEqual({
      guestName: "Jane", guestPhone: "+49", guestEmail: "j@e.com",
      nationality: "DE", idNumber: "X1", passengerCount: 2,
      hasLicence: true, licenceNumber: "L1", bornBefore1980: false,
    });
    expect(row.payment).toEqual({
      rentalFee: "3100 NOK", depositAmount: "5000 NOK", depositReceived: true,
      depositReturned: false, depositDeduction: "",
    });
    expect(row.signature_path).toBe("signatures/r1.png");
    expect("checkoutDamages" in row).toBe(false);
  });
  it("rowToRental rebuilds the flat Rental (damages injected separately)", () => {
    const row = rentalToRow(rental);
    const rebuilt = rowToRental(row, [], []);
    expect(rebuilt).toEqual(rental);
  });
  it("rowToRental injects checkout/checkin damages", () => {
    const row = rentalToRow(rental);
    const d: Damage = { id: "d1", view: "bb", px: 1, py: 2, photoPaths: [], desc: "", date: 1, repairedAt: null };
    const rebuilt = rowToRental(row, [d], []);
    expect(rebuilt.checkoutDamages).toEqual([d]);
    expect(rebuilt.checkinDamages).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `lib/mappers.ts` does not export these functions.

- [ ] **Step 3: Implement `lib/mappers.ts`**

```ts
import type { Boat, Damage, Rental } from "./types";

type Phase = "checkout" | "checkin";

export function rowToBoat(row: any): Boat {
  return {
    id: row.id,
    name: row.name,
    registration: row.registration ?? "",
    available: row.available ?? true,
  };
}

export function damageToRow(d: Damage, rentalId: string, boatId: string, phase: Phase) {
  return {
    id: d.id,
    rental_id: rentalId,
    boat_id: boatId,
    phase,
    view: d.view,
    px: d.px,
    py: d.py,
    photo_paths: d.photoPaths,
    description: d.desc,
    repaired_at: d.repairedAt,
    created_at: new Date(d.date).toISOString(),
  };
}

export function rowToDamage(row: any): Damage {
  return {
    id: row.id,
    view: row.view,
    px: row.px,
    py: row.py,
    photoPaths: row.photo_paths ?? [],
    desc: row.description ?? "",
    date: new Date(row.created_at).getTime(),
    repairedAt: row.repaired_at ?? null,
  };
}

export function rentalToRow(r: Rental) {
  return {
    id: r.id,
    created_at: r.createdAt,
    status: r.status,
    guest: {
      guestName: r.guestName,
      guestPhone: r.guestPhone,
      guestEmail: r.guestEmail,
      nationality: r.nationality,
      idNumber: r.idNumber,
      passengerCount: r.passengerCount,
      hasLicence: r.hasLicence,
      licenceNumber: r.licenceNumber,
      bornBefore1980: r.bornBefore1980,
    },
    id_photo_path: r.idPhotoPath || null,
    id_photo_back_path: r.idPhotoBackPath || null,
    licence_photo_path: r.licencePhotoPath || null,
    signature_path: r.signaturePath || null,
    boat_id: r.boatId || null,
    boat_name: r.boatName,
    checkout_date: r.checkoutDate || null,
    return_date: r.returnDate || null,
    actual_return: r.actualReturn || null,
    safety_checklist: r.safetyChecklist,
    checkout_fuel: r.checkoutFuel,
    checkin_fuel: r.checkinFuel,
    payment: {
      rentalFee: r.rentalFee,
      depositAmount: r.depositAmount,
      depositReceived: r.depositReceived,
      depositReturned: r.depositReturned,
      depositDeduction: r.depositDeduction,
    },
  };
}

export function rowToRental(row: any, checkoutDamages: Damage[], checkinDamages: Damage[]): Rental {
  const g = row.guest ?? {};
  const p = row.payment ?? {};
  return {
    id: row.id,
    createdAt: row.created_at,
    status: row.status,
    guestName: g.guestName ?? "",
    guestPhone: g.guestPhone ?? "",
    guestEmail: g.guestEmail ?? "",
    nationality: g.nationality ?? "",
    idNumber: g.idNumber ?? "",
    idPhotoPath: row.id_photo_path ?? "",
    idPhotoBackPath: row.id_photo_back_path ?? "",
    passengerCount: g.passengerCount ?? 1,
    hasLicence: g.hasLicence ?? false,
    licenceNumber: g.licenceNumber ?? "",
    licencePhotoPath: row.licence_photo_path ?? "",
    bornBefore1980: g.bornBefore1980 ?? false,
    boatId: row.boat_id ?? "",
    boatName: row.boat_name ?? "",
    checkoutDate: row.checkout_date ?? "",
    returnDate: row.return_date ?? "",
    actualReturn: row.actual_return ?? "",
    safetyChecklist: row.safety_checklist ?? {},
    checkoutDamages,
    checkinDamages,
    checkoutFuel: row.checkout_fuel ?? "Full",
    checkinFuel: row.checkin_fuel ?? "",
    rentalFee: p.rentalFee ?? "",
    depositAmount: p.depositAmount ?? "",
    depositReceived: p.depositReceived ?? false,
    depositReturned: p.depositReturned ?? false,
    depositDeduction: p.depositDeduction ?? "",
    signaturePath: row.signature_path ?? "",
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (all mapper tests green).

- [ ] **Step 5: Commit**

```bash
git add lib/mappers.ts lib/mappers.test.ts
git commit -m "feat: add tested row<->domain mappers for supabase"
```

---

## Task 4: Supabase clients + middleware

**Files:**
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`
- Create: `lib/supabase/middleware.ts`
- Create: `middleware.ts`

- [ ] **Step 1: Browser client**

Create `lib/supabase/client.ts`:
```ts
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 2: Server client (route handlers)**

Create `lib/supabase/server.ts`:
```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // called from a Server Component — safe to ignore when middleware refreshes sessions
          }
        },
      },
    }
  );
}
```

- [ ] **Step 3: Middleware session helper + route gate**

Create `lib/supabase/middleware.ts`:
```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/"));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return response;
}
```

Create `middleware.ts` (repo root):
```ts
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons|boots|boats|manifest.json|sw.js|workbox-.*|.*\\.png$|.*\\.svg$).*)",
  ],
};
```

- [ ] **Step 4: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: no NEW errors in the four new files (pre-existing errors from Task 2 in pages/pdf
still present — fixed later).

- [ ] **Step 5: Commit**

```bash
git add lib/supabase/client.ts lib/supabase/server.ts lib/supabase/middleware.ts middleware.ts
git commit -m "feat: add supabase browser/server clients and auth middleware"
```

---

## Task 5: Storage upload helpers

**Files:**
- Create: `lib/upload.ts`

- [ ] **Step 1: Implement `lib/upload.ts`**

```ts
import { createClient } from "@/lib/supabase/client";

export type Bucket = "id-photos" | "damage-photos" | "signatures";

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, b64] = dataUrl.split(",");
  const mime = /:(.*?);/.exec(meta)?.[1] ?? "image/jpeg";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/** Uploads a base64 data URL to a bucket and returns the stored path. */
export async function uploadDataUrl(dataUrl: string, bucket: Bucket, path: string): Promise<string> {
  const supabase = createClient();
  const blob = dataUrlToBlob(dataUrl);
  const { error } = await supabase.storage.from(bucket).upload(path, blob, {
    contentType: blob.type,
    upsert: true,
  });
  if (error) throw new Error(`Could not upload image: ${error.message}`);
  return `${bucket}/${path}`;
}

function splitPath(fullPath: string): { bucket: Bucket; path: string } {
  const slash = fullPath.indexOf("/");
  return { bucket: fullPath.slice(0, slash) as Bucket, path: fullPath.slice(slash + 1) };
}

/** Returns a short-lived signed URL for displaying a private object. */
export async function getSignedUrl(fullPath: string, expiresInSec = 3600): Promise<string> {
  if (!fullPath) return "";
  const supabase = createClient();
  const { bucket, path } = splitPath(fullPath);
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSec);
  if (error) throw new Error(`Could not load image: ${error.message}`);
  return data.signedUrl;
}

/** Fetches a stored object and returns it as a base64 data URL (for jsPDF). */
export async function dataUrlFromPath(fullPath: string): Promise<string> {
  if (!fullPath) return "";
  const url = await getSignedUrl(fullPath, 600);
  const res = await fetch(url);
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read stored image."));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}

/** Deletes objects by full path (bucket/key), grouped per bucket. */
export async function deletePaths(fullPaths: string[]): Promise<void> {
  const valid = fullPaths.filter(Boolean);
  if (!valid.length) return;
  const supabase = createClient();
  const byBucket = new Map<Bucket, string[]>();
  for (const fp of valid) {
    const { bucket, path } = splitPath(fp);
    byBucket.set(bucket, [...(byBucket.get(bucket) ?? []), path]);
  }
  for (const [bucket, paths] of byBucket) {
    await supabase.storage.from(bucket).remove(paths);
  }
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no new errors in `lib/upload.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/upload.ts
git commit -m "feat: add supabase storage upload/signed-url/delete helpers"
```

---

## Task 6: Rewrite `lib/storage.ts` (async, Supabase-backed)

**Files:**
- Rewrite: `lib/storage.ts`
- Delete: `lib/safe-storage.ts`

- [ ] **Step 1: Replace `lib/storage.ts` entirely**

```ts
import { createClient } from "@/lib/supabase/client";
import { rowToBoat, rowToDamage, damageToRow, rowToRental, rentalToRow } from "@/lib/mappers";
import { deletePaths } from "@/lib/upload";
import type { Boat, Damage, Rental } from "./types";

export async function getBoats(): Promise<Boat[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from("boats").select("*").order("name");
  if (error) throw new Error(`Could not load boats: ${error.message}`);
  return (data ?? []).map(rowToBoat);
}

/** Active (non-repaired) damages for a boat, used to show history on new rentals. */
export async function getBoatDamages(boatId: string): Promise<Damage[]> {
  if (!boatId) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("damages")
    .select("*")
    .eq("boat_id", boatId)
    .is("repaired_at", null)
    .order("created_at");
  if (error) throw new Error(`Could not load boat damages: ${error.message}`);
  return (data ?? []).map(rowToDamage);
}

async function damagesForRental(rentalId: string): Promise<{ checkout: Damage[]; checkin: Damage[] }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("damages")
    .select("*")
    .eq("rental_id", rentalId)
    .order("created_at");
  if (error) throw new Error(`Could not load damages: ${error.message}`);
  const checkout: Damage[] = [];
  const checkin: Damage[] = [];
  for (const row of data ?? []) {
    (row.phase === "checkin" ? checkin : checkout).push(rowToDamage(row));
  }
  return { checkout, checkin };
}

export async function getRentals(): Promise<Rental[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from("rentals").select("*").order("created_at", { ascending: false });
  if (error) throw new Error(`Could not load rentals: ${error.message}`);
  const rentals: Rental[] = [];
  for (const row of data ?? []) {
    const { checkout, checkin } = await damagesForRental(row.id);
    rentals.push(rowToRental(row, checkout, checkin));
  }
  return rentals;
}

export async function getRental(id: string): Promise<Rental | undefined> {
  const supabase = createClient();
  const { data, error } = await supabase.from("rentals").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`Could not load rental: ${error.message}`);
  if (!data) return undefined;
  const { checkout, checkin } = await damagesForRental(data.id);
  return rowToRental(data, checkout, checkin);
}

/**
 * Saves a rental (upsert) and its damages. The DB partial unique index
 * `one_active_rental_per_boat` enforces one active rental per boat; a violation
 * surfaces as a friendly error.
 */
export async function saveRental(rental: Rental): Promise<void> {
  const supabase = createClient();

  const { error: rentalError } = await supabase.from("rentals").upsert(rentalToRow(rental));
  if (rentalError) {
    if (rentalError.code === "23505") {
      throw new Error("This boat is already out on the water. Please confirm the return first.");
    }
    throw new Error(`Could not save rental: ${rentalError.message}`);
  }

  const rows = [
    ...rental.checkoutDamages.map((d) => damageToRow(d, rental.id, rental.boatId, "checkout")),
    ...rental.checkinDamages.map((d) => damageToRow(d, rental.id, rental.boatId, "checkin")),
  ];
  if (rows.length) {
    const { error: dmgError } = await supabase.from("damages").upsert(rows);
    if (dmgError) throw new Error(`Could not save damages: ${dmgError.message}`);
  }
}

/** Soft-delete: hides a damage from new rentals but keeps it on its original rental. */
export async function markDamageRepaired(damageId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("damages")
    .update({ repaired_at: new Date().toISOString() })
    .eq("id", damageId);
  if (error) throw new Error(`Could not mark damage repaired: ${error.message}`);
}

export async function deleteRental(id: string): Promise<void> {
  const supabase = createClient();

  const rental = await getRental(id);
  if (rental) {
    const photoPaths = [
      rental.idPhotoPath,
      rental.idPhotoBackPath,
      rental.licencePhotoPath,
      rental.signaturePath,
      ...rental.checkoutDamages.flatMap((d) => d.photoPaths),
      ...rental.checkinDamages.flatMap((d) => d.photoPaths),
    ];
    await deletePaths(photoPaths);
  }

  // damages rows are removed via ON DELETE CASCADE
  const { error } = await supabase.from("rentals").delete().eq("id", id);
  if (error) throw new Error(`Could not delete rental: ${error.message}`);
}
```

- [ ] **Step 2: Delete the obsolete localStorage helper**

Run: `git rm lib/safe-storage.ts`
Expected: file removed. (`config/page.tsx` still imports it — fixed in Task 9.)

- [ ] **Step 3: Verify type-check scope**

Run: `npx tsc --noEmit`
Expected: remaining errors are only in `app/**` pages, `components/damage-report.tsx`, `lib/pdf.ts`
(call sites needing `await` / renamed fields) — addressed in Tasks 7–11.

- [ ] **Step 4: Commit**

```bash
git add lib/storage.ts
git commit -m "feat: rewrite storage layer against supabase; remove localStorage helper"
```

---

## Task 7: Wire dashboard + config pages (async reads)

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/config/page.tsx`

- [ ] **Step 1: Dashboard — await `getRentals`**

In `app/page.tsx`, replace the effect:
```tsx
  useEffect(() => {
    try {
      setRentals(getRentals());
    } catch (error) {
      alert(getErrorMessage(error));
    }
  }, []);
```
with:
```tsx
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setRentals(await getRentals());
      } catch (error) {
        alert(getErrorMessage(error));
      } finally {
        setLoading(false);
      }
    })();
  }, []);
```
Then, immediately after the opening `<div className="py-8 space-y-8">`, add a loading guard:
```tsx
      {loading && <p className="text-center text-gray-400 py-20">Loading…</p>}
```
and wrap the existing content blocks so they render only when `!loading` (simplest: change the
empty-state condition `rentals.length === 0` to `!loading && rentals.length === 0`).

- [ ] **Step 2: Config — Supabase-backed boats**

Replace `app/config/page.tsx` entirely:
```tsx
"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getBoats } from "@/lib/storage";
import { getErrorMessage } from "@/lib/utils";
import type { Boat } from "@/lib/types";

export default function ConfigPage() {
  const router = useRouter();
  const [boats, setBoats] = useState<Boat[]>([]);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setBoats(await getBoats());
      } catch (error) {
        alert(getErrorMessage(error));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function save() {
    try {
      const supabase = createClient();
      for (const b of boats) {
        const { error } = await supabase.from("boats").update({ registration: b.registration }).eq("id", b.id);
        if (error) throw new Error(error.message);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      alert(getErrorMessage(error));
    }
  }

  function updateBoat(id: string, value: string) {
    setBoats(prev => prev.map(b => b.id === id ? { ...b, registration: value } : b));
  }

  return (
    <div className="py-6 min-h-screen">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.push("/")} className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center transition">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">Configuration</h1>
          <p className="text-sm text-gray-500">Fleet</p>
        </div>
        <button onClick={save} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors" style={{ backgroundColor: saved ? "#16a34a" : "#1B2A4A" }}>
          {saved ? "Saved ✓" : "Save"}
        </button>
      </div>

      {loading ? (
        <p className="text-center text-gray-400 py-20">Loading…</p>
      ) : (
        <div className="space-y-3">
          {boats.map(boat => (
            <div key={boat.id} className="rounded-xl border border-gray-100 p-4">
              <div className="flex gap-3 items-center">
                <span className="font-medium text-gray-800 flex-1 py-2">{boat.name}</span>
                <input className="w-28 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-500 focus:outline-none focus:border-brand" value={boat.registration} onChange={e => updateBoat(boat.id, e.target.value)} placeholder="Reg. no." />
              </div>
            </div>
          ))}
          <p className="text-xs text-gray-400">Edit registration numbers inline. Tap Save when done.</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Manual verification (requires Supabase setup done)**

Run: `npm run dev`, open the app, log in is not built yet — temporarily visit `/` directly.
Expected: dashboard loads (empty), `/config` lists Tind & Nordlys from Supabase; editing a
registration and Save persists (refresh shows the saved value; row visible in Supabase Table Editor).

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx app/config/page.tsx
git commit -m "feat: load dashboard and fleet config from supabase"
```

---

## Task 8: Damage report — Storage uploads + mark repaired

**Files:**
- Create: `components/stored-img.tsx`
- Modify: `components/damage-report.tsx`

- [ ] **Step 1: Create the shared signed-URL image component**

Create `components/stored-img.tsx` (shared by the damage report, wizards, and detail page — it
resolves a Storage path to a short-lived signed URL for display):
```tsx
"use client";
import { useEffect, useState } from "react";
import { getSignedUrl } from "@/lib/upload";

export default function StoredImg({ path, className, onClick }: { path: string; className?: string; onClick?: () => void }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let active = true;
    if (!path) { setUrl(""); return; }
    getSignedUrl(path).then((u) => { if (active) setUrl(u); }).catch(() => {});
    return () => { active = false; };
  }, [path]);
  if (!url) return <div className={className} style={{ background: "#f3f4f6" }} />;
  return <img src={url} className={className} alt="" onClick={onClick} />;
}
```
Then import it in `components/damage-report.tsx`:
```tsx
import StoredImg from "@/components/stored-img";
```

- [ ] **Step 2: Upload damage photos on capture instead of holding base64**

`SheetState.photos` now holds **Storage paths**. Update the "Take photo" handler in the `new`
branch to upload immediately. Replace:
```tsx
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const dataUrl = await readAndCompressImage(file, { maxSize: 1000, quality: 0.72 });
                        setSheet((prev) => (prev ? { ...prev, photos: [...prev.photos, dataUrl] } : null));
                        e.target.value = "";
                      }}
```
with:
```tsx
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const dataUrl = await readAndCompressImage(file, { maxSize: 1000, quality: 0.72 });
                        const damageId = sheet.damageId;
                        const idx = sheet.photos.length;
                        const path = await uploadDataUrl(dataUrl, "damage-photos", `${_boatId}/${damageId}/${idx}.jpg`);
                        setSheet((prev) => (prev ? { ...prev, photos: [...prev.photos, path] } : null));
                        e.target.value = "";
                      }}
```
Add `import { uploadDataUrl } from "@/lib/upload";` and `import { markDamageRepaired } from "@/lib/storage";` at the top.

- [ ] **Step 3: Generate the damage id when opening the "new" sheet**

`SheetState` needs a stable `damageId` (so photo paths are grouped before save). Add `damageId: string`
to the `SheetState` interface, and in `handleImageTap` set it:
```tsx
      setSheet({ mode: "new", view, px, py, photos: [], desc: "", damageId: crypto.randomUUID() });
```
In `saveDamage`, reuse it:
```tsx
  const saveDamage = () => {
    if (!sheet) return;
    const d: Damage = {
      id: sheet.damageId,
      view: sheet.view,
      px: sheet.px,
      py: sheet.py,
      photoPaths: sheet.photos,
      desc: sheet.desc,
      date: Date.now(),
      repairedAt: null,
    };
    onChange([...damages, d]);
    setSheet(null);
  };
```
In `handleDotTap`, set `damageId` from the tapped damage and use `photoPaths`:
```tsx
  const handleDotTap = useCallback((e: React.MouseEvent, damage: Damage) => {
    e.stopPropagation();
    setSheet({ mode: "view", view: damage.view, px: damage.px, py: damage.py, damage, photos: damage.photoPaths, desc: damage.desc, damageId: damage.id });
  }, []);
```

- [ ] **Step 4: Render previews via `StoredImg`**

In the `new` branch preview grid, replace `<img src={p} .../>` with `<StoredImg path={p} className="w-full h-32 object-cover" />`.
In the `view` branch, replace the photo `<img src={p} .../>` with
`<StoredImg path={p} className="w-full h-36 object-cover" onClick={() => setLightbox(p)} />`,
and change the lightbox to resolve the path: keep `lightbox` holding the path and render
`{lightbox && <StoredImg path={lightbox} className="max-w-full max-h-full object-contain" />}` inside the lightbox overlay.

- [ ] **Step 5: Add "Mark as repaired" to existing damages**

In the `view` branch, replace the `!isExisting(...)` delete-only block with both actions:
```tsx
                {isExisting(sheet.damage) ? (
                  <Button
                    variant="danger"
                    size="lg"
                    onClick={async () => {
                      if (!sheet.damage) return;
                      if (!confirm("Mark this damage as repaired? It will stop showing on new rentals.")) return;
                      await markDamageRepaired(sheet.damage.id);
                      setSheet(null);
                      onRepaired?.(sheet.damage.id);
                    }}
                  >
                    Mark as repaired
                  </Button>
                ) : (
                  <Button variant="danger" size="lg" onClick={() => sheet.damage && deleteDamage(sheet.damage.id)}>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete damage
                  </Button>
                )}
```
Add an optional `onRepaired?: (id: string) => void` to `Props` so the parent can refresh its
`existingDamages` list. (Parents pass a handler that re-runs `getBoatDamages`.)

- [ ] **Step 6: Verify type-check**

Run: `npx tsc --noEmit`
Expected: no errors in `components/damage-report.tsx` (page-level errors may remain until Task 9).

- [ ] **Step 7: Commit**

```bash
git add components/stored-img.tsx components/damage-report.tsx
git commit -m "feat: upload damage photos to storage and add mark-as-repaired"
```

---

## Task 9: Wire new-rental + return wizards

**Files:**
- Modify: `app/rental/new/page.tsx`
- Modify: `app/rental/[id]/return/page.tsx`

- [ ] **Step 1: New-rental — async boat load + ID/licence uploads**

In `app/rental/new/page.tsx` make the boats effect async (mirror Task 7 Step 1 pattern, awaiting
`getBoats()` and `getRentals()`), and make `boatDamages` load via state+effect instead of `useMemo`
(since `getBoatDamages` is now async):
```tsx
  const [boatDamages, setBoatDamages] = useState<import("@/lib/types").Damage[]>([]);
  const refreshBoatDamages = useCallback(async () => {
    try { setBoatDamages(rental.boatId ? await getBoatDamages(rental.boatId) : []); }
    catch (e) { alert(getErrorMessage(e)); }
  }, [rental.boatId]);
  useEffect(() => { refreshBoatDamages(); }, [refreshBoatDamages]);
```
Pass `onRepaired={refreshBoatDamages}` to `<DamageReport .../>`.

- [ ] **Step 2: Upload ID/licence photos on capture**

In `StepGuest`, the two ID `<input type="file">` `onChange` handlers currently do
`update({ idPhotoData: await readAndCompressImage(...) })`. Replace with upload-then-store-path,
and keep a session preview. Change the front handler to:
```tsx
            onChange={async e => {
              const file = e.target.files?.[0]; if (!file) return;
              const dataUrl = await readAndCompressImage(file, { maxSize: 1000, quality: 0.72 });
              const path = await uploadDataUrl(dataUrl, "id-photos", `${rental.id}/id-front.jpg`);
              update({ idPhotoPath: path });
            }}
```
and the preview `<img src={rental.idPhotoData} .../>` to `<StoredImg path={rental.idPhotoPath} className="w-full h-48 object-cover" />`.
Apply the same change to the back handler (`id-back.jpg`, `idPhotoBackPath`).
Import `uploadDataUrl` from `@/lib/upload` and `StoredImg` from `@/components/stored-img`
(created in Task 8).

- [ ] **Step 3: Signature upload**

In `StepSign`, `SignaturePad` returns a base64 PNG via `onChange`. Upload it and store the path.
Change the handler:
```tsx
        <SignaturePad value={rental.signaturePath} onChange={async sig => {
          if (!sig) { update({ signaturePath: "" }); return; }
          const path = await uploadDataUrl(sig, "signatures", `${rental.id}.png`);
          update({ signaturePath: path });
        }} />
```
Note: `SignaturePad`'s `value` is used to prefill; passing a path is fine because the component
only checks truthiness to show "signed" state. If `SignaturePad` renders `value` as an image src,
wrap with a `StoredImg`-resolved URL instead — check `components/signature-pad.tsx` and adapt.

- [ ] **Step 4: `complete()` is already correct shape — make async-safe**

`saveRental` is now async. Update `complete()`:
```tsx
  const complete = async () => {
    try {
      const doc = await generateRentalPDF(rental, RENTAL_TERMS);
      const arrayBuffer = doc.output("arraybuffer");
      const blob = new Blob([arrayBuffer], { type: "application/pdf" });
      await saveRental(rental);
      setPdfBlob(blob);
      setStep(6);
    } catch (err) {
      console.error("Could not complete rental:", err);
      alert(getErrorMessage(err));
    }
  };
```
(`generateRentalPDF` becomes async in Task 10.)

- [ ] **Step 5: Return wizard — same async treatment**

In `app/rental/[id]/return/page.tsx`: await `getRental`; convert `boatDamages` `useMemo` to
state+effect with a `refreshBoatDamages` (as Step 1) and pass `onRepaired`; make `complete()`
`async` awaiting `generateReturnPDF` and `saveRental`.

- [ ] **Step 6: Manual verification**

Run: `npm run dev`. Complete a full new rental (ID front photo, one damage with a photo,
signature). Expected: completes without error; in Supabase, a `rentals` row exists (small),
`damages` rows exist, and objects appear in `id-photos`, `damage-photos`, `signatures` buckets.

- [ ] **Step 7: Commit**

```bash
git add app/rental/new/page.tsx app/rental/[id]/return/page.tsx
git commit -m "feat: wire rental wizards to supabase storage and async save"
```

---

## Task 10: PDF generation from Storage + detail page

**Files:**
- Modify: `lib/pdf.ts`
- Modify: `app/rental/[id]/page.tsx`

- [ ] **Step 1: Make PDF builders async and resolve images**

In `lib/pdf.ts`, import the resolver and change both exported functions to async, resolving paths
to base64 before drawing. At the top:
```ts
import { dataUrlFromPath } from "./upload";
```
Change `generateRentalPDF(rental, terms?)` signature to `export async function generateRentalPDF(rental: Rental, terms?: string): Promise<jsPDF>` and, before the ID-photo block, resolve them:
```ts
  const idFront = await dataUrlFromPath(rental.idPhotoPath);
  const idBack = await dataUrlFromPath(rental.idPhotoBackPath);
  const signature = await dataUrlFromPath(rental.signaturePath);
```
Replace usages of `rental.idPhotoData`→`idFront`, `rental.idPhotoDataBack`→`idBack`,
`rental.signatureData`→`signature`. For damages, resolve each photo: in `damageSection`, since it
needs async, pre-resolve before calling. Simplest: change `damageSection` to accept already-resolved
data URLs by mapping damages first:
```ts
  // before calling damageSection for checkout/checkin damages:
  const resolveDamages = async (ds: Damage[]) =>
    Promise.all(ds.map(async (d) => ({
      ...d,
      _photos: await Promise.all(d.photoPaths.map(dataUrlFromPath)),
    })));
```
Update `damageSection` to read `d._photos` (typed as `(Damage & { _photos: string[] })[]`) instead
of `d.photos`/`d.photoPaths` for `addImage`. Apply the same async conversion to `generateReturnPDF`.

- [ ] **Step 2: Update all PDF call sites to await**

The wizards (Task 9) already await. In `app/rental/[id]/page.tsx`, make the PDF handlers async:
```tsx
  const downloadRentalPDF = async () => {
    const doc = await generateRentalPDF(rental, RENTAL_TERMS);
    doc.save(`sommarbukt-handover-${sanitizeFilename(rental.guestName)}-${rental.id.slice(0, 8)}.pdf`);
  };
  const downloadReturnPDF = async () => {
    const doc = await generateReturnPDF(rental);
    doc.save(`sommarbukt-return-${sanitizeFilename(rental.guestName)}-${rental.id.slice(0, 8)}.pdf`);
  };
```
In `sendPDF`, change `const doc = type === "rental" ? generateRentalPDF(...) : generateReturnPDF(...)`
to `const doc = type === "rental" ? await generateRentalPDF(rental, RENTAL_TERMS) : await generateReturnPDF(rental);`.

- [ ] **Step 3: Detail page — async load + StoredImg for ID/signature**

Make the load effect await `getRental` (mirror Task 7 Step 1). Replace the ID photo and signature
`<img src={...} />` with `<StoredImg path={rental.idPhotoPath} .../>` etc (import from
`components/stored-img.tsx`). Make `handleDelete` async awaiting `deleteRental`.

- [ ] **Step 4: Verify type-check passes for the whole project**

Run: `npx tsc --noEmit`
Expected: **0 errors.**

- [ ] **Step 5: Manual verification**

Open a completed rental → Download Hand-Over PDF. Expected: PDF opens with ID photo, damage
photos, and signature embedded. Delete a rental → its photos disappear from the buckets and the
row/damages are gone.

- [ ] **Step 6: Commit**

```bash
git add lib/pdf.ts app/rental/[id]/page.tsx
git commit -m "feat: generate PDFs from supabase storage; async detail page"
```

---

## Task 11: Login page, secure email route, final cleanup

**Files:**
- Create: `app/login/page.tsx`
- Modify: `app/api/send-email/route.ts`
- Modify: `app/rental/new/page.tsx`, `app/rental/[id]/page.tsx`, `app/rental/[id]/return/page.tsx`

- [ ] **Step 1: Login page**

Create `app/login/page.tsx`:
```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getErrorMessage } from "@/lib/utils";
import Button from "@/components/ui/button";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function signIn() {
    setBusy(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error("Login failed. Check email and password.");
      router.push("/");
      router.refresh();
    } catch (e) {
      alert(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-center max-w-sm mx-auto px-6 space-y-5">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">SOMMARBUKT</h1>
        <p className="text-sm text-gray-500 mt-0.5">Boat Rental — Staff Login</p>
      </div>
      <input className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50" type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
      <input className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && signIn()} />
      <Button size="lg" onClick={signIn} disabled={busy || !email || !password}>
        {busy ? "Signing in…" : "Sign in"}
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Secure the email route**

In `app/api/send-email/route.ts`, replace the token check:
```ts
    const expectedToken = process.env.NEXT_PUBLIC_API_TOKEN;
    if (!expectedToken || req.headers.get("x-api-token") !== expectedToken) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
```
with a session check (add `import { createClient } from "@/lib/supabase/server";` at the top):
```ts
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
```

- [ ] **Step 3: Remove the `x-api-token` header from all fetch calls**

In `app/rental/new/page.tsx`, `app/rental/[id]/page.tsx`, `app/rental/[id]/return/page.tsx`,
change each `headers` object from:
```tsx
        headers: { "Content-Type": "application/json", "x-api-token": process.env.NEXT_PUBLIC_API_TOKEN ?? "" },
```
to:
```tsx
        headers: { "Content-Type": "application/json" },
```
(The session cookie authenticates the request automatically.)

- [ ] **Step 4: Verify no stale references remain**

Run: `npx tsc --noEmit` (expect 0 errors) and grep for leftovers:
```bash
grep -rn "NEXT_PUBLIC_API_TOKEN\|idPhotoData\|idPhotoDataBack\|licencePhotoData\|signatureData\|safe-storage" app components lib
```
Expected: no matches (all migrated). Fix any that appear. (Note: `sheet.photos` inside
`damage-report.tsx` is a legitimate in-memory field of `SheetState` and is intentionally kept.)

- [ ] **Step 5: Manual end-to-end verification (full spec §10)**

Run `npm run dev`:
1. Logged out → any route redirects to `/login`.
2. Sign in with the shared account → dashboard loads.
3. New rental end-to-end → row + damages + photos in Supabase; PDF has images.
4. Email PDF to a test address → succeeds (route returns 200 with a session).
5. Sign out / use an incognito window without a session → POST `/api/send-email` returns 401.
6. Return flow → status `completed`, return PDF correct.
7. Mark an existing damage repaired → gone from a new rental, still on the old one.
8. Second device/browser logs in → sees the same rentals.
9. Start a second active rental on a boat already out → blocked with the friendly message.

- [ ] **Step 6: Commit**

```bash
git add app/login/page.tsx app/api/send-email/route.ts app/rental/new/page.tsx app/rental/[id]/page.tsx app/rental/[id]/return/page.tsx
git commit -m "feat: add staff login and verify session on email route; drop public token"
```

---

## Task 12: Build verification + docs

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Production build**

Run: `npm run build`
Expected: build succeeds with no type errors.

- [ ] **Step 2: Run unit tests**

Run: `npm test`
Expected: mapper tests PASS.

- [ ] **Step 3: Update README**

Replace `README.md` body with a short setup section pointing at the spec's §8 walkthrough and the
required env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, SMTP_*). One paragraph + the run commands (`npm run dev`, `npm test`).

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: document supabase setup and env vars"
```

---

## Definition of Done

- `npm run build` and `npm test` both pass.
- All spec §10 manual checks pass on the running app.
- No references to `localStorage` data, `safe-storage`, base64 photo fields, or
  `NEXT_PUBLIC_API_TOKEN` remain.
- Data is visible across two devices; photos live in private buckets; routes require login.
