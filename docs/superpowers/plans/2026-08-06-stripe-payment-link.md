# Stripe Payment Link on Rental-Complete Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a Stripe Payment Link (as a QR code + clickable button) on the rental-complete step of the wizard, so a guest can pay the rental fee on the spot — via their own phone (scan) or the staff tablet (click).

**Architecture:** A single static Stripe Payment Link URL (created manually in the Stripe Dashboard, "customer chooses the amount") is read from `NEXT_PUBLIC_STRIPE_PAYMENT_LINK`. A new presentational component `PaymentQR` renders a QR code of that URL plus a button that opens it in a new tab. It's rendered inside the existing `StepDone` component in `app/rental/new/page.tsx`, below the existing PDF/email/dashboard buttons. No backend, no database changes, no payment-status tracking — per [docs/superpowers/specs/2026-08-06-stripe-payment-link-design.md](../specs/2026-08-06-stripe-payment-link-design.md).

**Tech Stack:** Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, `qrcode.react` (new dependency) for QR rendering.

---

## Spec Decisions Carried Into This Plan

- No server code, no Supabase changes, no webhook — the payment link is fully static and independent of the `rentals` record.
- No automated component test is written. The component has no branching logic beyond "env var present or not" and no test harness (jsdom/React Testing Library) exists in this repo (`vitest.config.ts` only runs `lib/**/*.test.ts` under `environment: "node"`). Verification is a manual browser check (Task 3), matching the "Tests" section of the design spec.
- Missing `NEXT_PUBLIC_STRIPE_PAYMENT_LINK` must not crash the page — the component renders nothing in that case.

## File Structure

- **Create:** `components/payment-qr.tsx` — the QR code + button component. Follows the existing lowercase-hyphenated naming used by `components/stored-img.tsx`, `components/signature-pad.tsx`, `components/damage-report.tsx`.
- **Modify:** `app/rental/new/page.tsx` — import and render `PaymentQR` inside `StepDone`.
- **Modify:** `.env.example` — document the new env var.
- **Modify:** `.env.local` — add the real (live) payment link URL for local dev/testing (already gitignored).
- **Modify:** `package.json` / `package-lock.json` (or equivalent lockfile) — new `qrcode.react` dependency.

---

### Task 1: Add the `qrcode.react` dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the package**

Run:
```bash
npm install qrcode.react
```

Expected: `package.json` gains `"qrcode.react": "^<version>"` under `"dependencies"`, and the lockfile updates.

- [ ] **Step 2: Verify the install**

Run:
```bash
npm ls qrcode.react
```

Expected output includes a line like `qrcode.react@<version>` with no `UNMET DEPENDENCY` error.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add qrcode.react dependency"
```

---

### Task 2: Document and set the env var

**Files:**
- Modify: `.env.example`
- Modify: `.env.local`

- [ ] **Step 1: Add the documented placeholder to `.env.example`**

Append to the end of `.env.example`:

```
# Stripe Payment Link shown as a QR code on the rental-complete page.
# Create in the Stripe Dashboard: Payment Links > + New > product with
# "Customer chooses the amount" price. Live-mode URL — do not commit the
# real value anywhere except deployment env vars / .env.local.
NEXT_PUBLIC_STRIPE_PAYMENT_LINK=https://buy.stripe.com/your-payment-link
```

- [ ] **Step 2: Add the real value to `.env.local`**

Append to `.env.local` (already gitignored, confirmed via `.gitignore`):

```
NEXT_PUBLIC_STRIPE_PAYMENT_LINK=https://buy.stripe.com/8x28wH0Vy1OadrOdXN3Nm00
```

- [ ] **Step 3: Verify `.env.local` is still ignored**

Run:
```bash
git status --porcelain
```

Expected: `.env.local` does NOT appear in the output (only `.env.example` should show as modified).

- [ ] **Step 4: Commit the example file only**

```bash
git add .env.example
git commit -m "docs: document NEXT_PUBLIC_STRIPE_PAYMENT_LINK env var"
```

---

### Task 3: Create the `PaymentQR` component

**Files:**
- Create: `components/payment-qr.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client";
import { QRCodeSVG } from "qrcode.react";
import { ExternalLink } from "lucide-react";
import Button from "@/components/ui/button";

export default function PaymentQR() {
  const url = process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK;

  if (!url) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("PaymentQR: NEXT_PUBLIC_STRIPE_PAYMENT_LINK is not set — payment option hidden.");
    }
    return null;
  }

  return (
    <div className="max-w-sm mx-auto space-y-3 pt-2 border-t border-gray-200">
      <p className="text-sm text-gray-500 pt-3">Take payment now (optional)</p>
      <div className="flex justify-center">
        <QRCodeSVG value={url} size={160} />
      </div>
      <Button
        size="lg"
        variant="secondary"
        onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
      >
        <ExternalLink className="w-5 h-5 mr-2" /> Open Payment Link
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Verify it type-checks**

Run:
```bash
npx tsc --noEmit
```

Expected: no errors referencing `components/payment-qr.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/payment-qr.tsx
git commit -m "feat: add PaymentQR component for Stripe payment link"
```

---

### Task 4: Render `PaymentQR` in `StepDone`

**Files:**
- Modify: `app/rental/new/page.tsx:460-490` (the `StepDone` function)

- [ ] **Step 1: Import the component**

In `app/rental/new/page.tsx`, add to the import block (after the `DamageReport` import on line 17):

```tsx
import PaymentQR from "@/components/payment-qr";
```

- [ ] **Step 2: Render it inside `StepDone`**

Replace the closing of the buttons block in `StepDone` (currently lines 473–487):

```tsx
      <div className="space-y-3 max-w-sm mx-auto">
        <Button size="lg" onClick={downloadPDF}>
          <Download className="w-5 h-5 mr-2" /> Download Hand-Over PDF
        </Button>

        {rental.guestEmail && (
          <Button size="lg" variant={sent ? "secondary" : "primary"} onClick={sendEmail} disabled={sending || sent}>
            <Send className="w-5 h-5 mr-2" /> {sent ? "Email Sent ✓" : sending ? "Sending..." : `Send to ${rental.guestEmail}`}
          </Button>
        )}

        <Button size="lg" variant="secondary" onClick={() => window.location.href = "/"}>
          Back to Dashboard
        </Button>
      </div>

      <PaymentQR />
    </div>
  );
}
```

(This adds `<PaymentQR />` right after the existing `<div className="space-y-3 max-w-sm mx-auto">...</div>` block, still inside the outer `<div className="text-center py-8 space-y-6">` wrapper — so it's visually separated by the `space-y-6` gap and the component's own top border.)

- [ ] **Step 3: Verify it type-checks**

Run:
```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/rental/new/page.tsx
git commit -m "feat: show Stripe payment QR on rental-complete step"
```

---

### Task 5: Manual browser verification

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server**

Run:
```bash
npm run dev
```

- [ ] **Step 2: Walk the wizard to the Done step**

Open the app in a browser, start a new rental (`/rental/new`), fill in the minimum required fields on each step (Guest name, boat selection, safety checks, condition, deposit, signature) and advance to the final "Done" step.

- [ ] **Step 3: Confirm the QR code and button render correctly**

Expected on the Done step, below the existing three buttons:
- A label "Take payment now (optional)"
- A visible QR code
- An "Open Payment Link" button

- [ ] **Step 4: Confirm the QR code encodes the right URL**

Scan the QR code with a phone camera (or use a QR-reading browser extension) and confirm it opens `https://buy.stripe.com/8x28wH0Vy1OadrOdXN3Nm00` and shows the "Boat Rental Fee" Stripe Checkout page with an editable amount field.

- [ ] **Step 5: Confirm the button opens the same link in a new tab**

Click "Open Payment Link". Expected: a new browser tab opens showing the same Stripe Checkout page; the original wizard tab still shows the Done step (wizard state not lost).

- [ ] **Step 6: Confirm graceful fallback when the env var is missing**

Temporarily comment out `NEXT_PUBLIC_STRIPE_PAYMENT_LINK` in `.env.local`, restart `npm run dev`, and revisit the Done step. Expected: no crash, no QR code/button rendered, a console warning `PaymentQR: NEXT_PUBLIC_STRIPE_PAYMENT_LINK is not set — payment option hidden.` appears in the browser dev console. Then restore the env var and restart the dev server.

---

## Deployment Note (not a plan task — inform the user)

The live env var `NEXT_PUBLIC_STRIPE_PAYMENT_LINK=https://buy.stripe.com/8x28wH0Vy1OadrOdXN3Nm00` must also be added to the production deployment's environment variables (e.g. Vercel project settings) — `.env.local` is not deployed.
