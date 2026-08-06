# Stripe Payment Link auf der Rental-Complete-Seite

## Kontext

Diese App ist ein internes Tool für Mitarbeiter der Bootsvermietung — kein
Kunden-Self-Checkout. Der Buchungsablauf ist ein 7-Schritte-Wizard
(`app/rental/new/page.tsx`): Guest → Rental → Safety Check → Condition →
Deposit → Signature → **Done**. Der letzte Schritt (`StepDone`) zeigt eine
Bestätigung ("Rental Complete") mit Buttons für PDF-Download, E-Mail-Versand
und Rückkehr zum Dashboard.

Zahlungsdaten werden aktuell nur informell erfasst: `rentalFee` (Freitext),
`depositAmount` (Auswahl 5000/10000 NOK), `depositReceived` (Checkbox). Es
gibt keine Zahlungsabwicklung und keine Stripe-Integration im Projekt.

Ziel: Ein Stripe Payment Link soll auf der Rental-Complete-Seite angezeigt
werden, damit der Kunde die Mietgebühr direkt vor Ort bezahlen kann — per
QR-Code-Scan mit dem eigenen Handy oder per Klick auf dem Mitarbeiter-Tablet.

## Entscheidungen aus dem Brainstorming

- **Kein Tap-to-Pay/NFC**: Das würde die native Stripe Terminal SDK
  erfordern und passt nicht zu einer reinen Web-App. Stattdessen: QR-Code,
  der auf einen Web-Payment-Link zeigt — der Kunde zahlt in seinem eigenen
  Browser.
- **Kaution bleibt unverändert**: Eine echte Kaution-Autorisierung (Stripe
  Hold/manual capture, später freigeben oder abbuchen) ist ein eigenständiges,
  deutlich komplexeres Feature (Payment Intents, Webhook, Status-Tracking im
  Rückgabe-Flow, 7-Tage-Ablauf von Kartenautorisierungen). Das ist bewusst
  außerhalb des Scopes dieser Spec und könnte ein späteres, separates Projekt
  werden.
- **Einfache statt dynamische Variante**: Statt eines serverseitig pro Miete
  generierten Payment Links (exakter Betrag, aber `STRIPE_SECRET_KEY` +
  API-Route + mehr Komplexität) wird ein einziger, statischer Payment Link
  verwendet, bei dem der Kunde den Betrag selbst einträgt. Kein Server-Code,
  keine neue Abhängigkeit zum Supabase-Schema, kein Abgleich zwischen Zahlung
  und Buchung.
- **Rein optional**: Die Zahlungsoption blockiert den Wizard nicht. Viele
  Kunden haben bereits im Vorfeld bezahlt — `StepDone` bleibt wie bisher
  vollständig nutzbar, auch ohne die Zahlungsfunktion anzuklicken.

## Architektur & Datenfluss

- Der Payment Link ist eine feste URL, einmalig im Stripe-Dashboard mit der
  Option "Kunde gibt Betrag selbst ein" ("customer chooses the amount")
  angelegt.
- Die URL wird als Umgebungsvariable `NEXT_PUBLIC_STRIPE_PAYMENT_LINK`
  hinterlegt (client-seitig sichtbar, passend zur bestehenden
  `NEXT_PUBLIC_*`-Konvention in `.env.example` — die URL ist ohnehin eine
  öffentliche Bezahladresse).
- Keine Datenbank-Änderung, kein Abgleich mit dem `rentals`-Datensatz in
  Supabase. Die Zahlung ist unabhängig vom Rental-Datensatz; Mitarbeiter
  prüft Zahlungseingänge bei Bedarf manuell im Stripe-Dashboard.
- Kreditkartendaten werden ausschließlich auf der Stripe-Checkout-Seite
  eingegeben, nie in der App selbst — keine PCI-Compliance-Anforderungen für
  dieses Projekt.

## Komponenten & UI

- Neue Komponente `components/PaymentQR.tsx`:
  - Rendert einen QR-Code (neue Abhängigkeit `qrcode.react`) der Payment-Link-URL.
  - Rendert zusätzlich einen klickbaren "Zahlung öffnen"-Button mit derselben
    URL (`target="_blank"`, damit der Wizard-Zustand im aktuellen Tab erhalten
    bleibt).
  - Falls `NEXT_PUBLIC_STRIPE_PAYMENT_LINK` nicht gesetzt ist, rendert die
    Komponente nichts (kein Crash), mit einer Konsolen-Warnung im Dev-Modus.
- Integration: `PaymentQR` wird in `StepDone` (`app/rental/new/page.tsx`)
  unterhalb der bestehenden Buttons (PDF-Download, E-Mail senden, Zurück zum
  Dashboard) eingebunden — direkt sichtbar, kein zusätzlicher Klick zum
  Einblenden nötig.

## Nutzungsszenarien

1. **Kunde zahlt mit eigenem Handy**: QR-Code scannen → Stripe-Checkout im
   Handy-Browser → Betrag eintippen → mit Karte, Apple Pay oder Google Pay
   bezahlen.
2. **Kunde zahlt auf dem Mitarbeiter-Tablet**: Button klicken → Stripe-Checkout
   öffnet sich im Tablet-Browser → Kunde tippt Betrag und Kartendaten direkt
   dort ein.
3. **Keine Zahlung nötig**: Kunde hat im Vorfeld bereits bezahlt — Mitarbeiter
   ignoriert die Zahlungsoption und schließt den Wizard wie bisher ab.

## Fehlerbehandlung

- Fehlende ENV-Variable → Komponente wird nicht gerendert, kein Absturz der
  Seite.
- Alle Zahlungsfehler (abgelehnte Karte, Abbruch etc.) werden komplett von
  Stripe auf der Checkout-Seite gehandhabt — die App muss darauf nicht
  reagieren, da keine Rückmeldung an die App erfolgt (keine Webhooks in dieser
  einfachen Variante).

## Tests

- Kein Zahlungsstatus-Tracking vorhanden, daher kein Integrationstest gegen
  Stripe nötig.
- Manueller Browsertest: QR-Code wird korrekt gerendert, Button öffnet die
  richtige URL in neuem Tab, Komponente verschwindet sauber ohne gesetzte
  ENV-Variable.

## Out of Scope (mögliche Folgeprojekte)

- Kaution als echter Stripe-Hold (Payment Intents mit `capture_method:
  manual`, Freigabe/Abbuchung im Rückgabe-Flow).
- Dynamisch generierter Payment Link mit exaktem Betrag aus `rentalFee`
  (erfordert Server-API-Route und `STRIPE_SECRET_KEY`).
- Automatischer Zahlungsstatus-Abgleich mit dem `rentals`-Datensatz via
  Stripe-Webhook.
