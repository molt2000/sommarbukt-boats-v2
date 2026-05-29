import jsPDF from "jspdf";
import { Damage, Rental } from "./types";
import { formatDate } from "./utils";

const BRAND = [27, 42, 74] as const; // #1B2A4A

const VIEW_LABELS: Record<string, string> = {
  stb: "Starboard",
  bb: "Port",
  front: "Bow",
  rear: "Stern",
  top: "Top view",
};

export function generateRentalPDF(rental: Rental, terms?: string): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  let y = 15;

  // Header
  doc.setFillColor(...BRAND);
  doc.rect(0, 0, w, 40, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("SOMMARBUKT", 15, 18);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("Boat Rental Agreement", 15, 26);
  doc.text(`Ref: ${rental.id.slice(0, 8).toUpperCase()}`, 15, 33);
  doc.text(formatDate(rental.createdAt), w - 15, 26, { align: "right" });

  y = 50;
  doc.setTextColor(30, 30, 30);

  // Guest info
  y = section(doc, "Guest Information", y);
  y = row(doc, "Name", rental.guestName, y);
  y = row(doc, "Phone", rental.guestPhone, y);
  y = row(doc, "Email", rental.guestEmail, y);
  y = row(doc, "Nationality", rental.nationality, y);
  y = row(doc, "ID Number", rental.idNumber, y);
  y = row(doc, "Passengers", String(rental.passengerCount), y);
  y = row(doc, "Boat Licence", rental.licenceNumber || "None", y);
  y = row(doc, "Born before 1980", rental.bornBefore1980 ? "Yes" : "No", y);

  y += 4;
  y = section(doc, "Rental Details", y);
  y = row(doc, "Boat", rental.boatName, y);
  y = row(doc, "Hand-Over", formatDate(rental.checkoutDate), y);
  y = row(doc, "Return Date", formatDate(rental.returnDate), y);
  y = row(doc, "Fuel Level", rental.checkoutFuel, y);

  y += 4;
  y = section(doc, "Safety Checklist", y);
  Object.entries(rental.safetyChecklist).forEach(([item, checked]) => {
    y = row(doc, item, checked ? "Yes" : "No", y);
  });

  y += 4;
  y = section(doc, "Deposit", y);
  if (rental.rentalFee) y = row(doc, "Rental Fee", rental.rentalFee, y);
  y = row(doc, "Deposit", rental.depositAmount, y);
  y = row(doc, "Deposit Received", rental.depositReceived ? "Yes" : "No", y);

  // ID photo
  if (rental.idPhotoData || rental.idPhotoDataBack) {
    y = checkNewPage(doc, y, 60);
    y += 4;
    y = section(doc, "ID Document", y);
    try {
      if (rental.idPhotoData) {
        doc.addImage(rental.idPhotoData, "JPEG", 15, y, 60, 40);
        doc.setFontSize(7);
        doc.setTextColor(100, 100, 100);
        doc.text("Front", 15, y + 43);
      }
      if (rental.idPhotoDataBack) {
        doc.addImage(rental.idPhotoDataBack, "JPEG", 80, y, 60, 40);
        doc.setFontSize(7);
        doc.setTextColor(100, 100, 100);
        doc.text("Back", 80, y + 43);
      }
      y += 48;
    } catch { y += 4; }
  }

  // Damage documentation
  y += 4;
  y = damageSection(doc, "Pre-Existing Damage (Hand-Over)", rental.checkoutDamages ?? [], y);

  // Terms & Conditions
  const cleanedTerms = (terms ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/%P/g, "\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (cleanedTerms) {
    y = checkNewPage(doc, y, 20);
    y += 4;
    y = section(doc, "Terms & Conditions", y);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    const termLines = doc.splitTextToSize(cleanedTerms, 180);
    for (const line of termLines) {
      y = checkNewPage(doc, y, 5);
      doc.text(line, 15, y);
      y += 4;
    }
    y += 4;
  }

  // Signature
  y = checkNewPage(doc, y, 50);
  y += 4;
  y = section(doc, "Agreement", y);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("The guest confirms acceptance of the rental terms, liability waiver, and safety briefing.", 15, y);
  y += 8;

  if (rental.signatureData) {
    try {
      doc.addImage(rental.signatureData, "PNG", 15, y, 60, 30);
      y += 34;
    } catch { y += 4; }
  }
  doc.setFontSize(9);
  doc.setTextColor(30, 30, 30);
  doc.text(rental.guestName, 15, y);
  doc.text(formatDate(rental.createdAt), 80, y);

  footer(doc);
  return doc;
}

export function generateReturnPDF(rental: Rental): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  let y = 15;

  doc.setFillColor(...BRAND);
  doc.rect(0, 0, w, 40, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("SOMMARBUKT", 15, 18);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("Boat Return Report", 15, 26);
  doc.text(`Ref: ${rental.id.slice(0, 8).toUpperCase()}`, 15, 33);
  doc.text(formatDate(rental.actualReturn || new Date().toISOString()), w - 15, 26, { align: "right" });

  y = 50;
  doc.setTextColor(30, 30, 30);

  y = section(doc, "Rental Reference", y);
  y = row(doc, "Guest", rental.guestName, y);
  y = row(doc, "Boat", rental.boatName, y);
  y = row(doc, "Hand-Over", formatDate(rental.checkoutDate), y);
  y = row(doc, "Returned", formatDate(rental.actualReturn), y);

  y += 4;
  y = section(doc, "Return Condition", y);
  y = row(doc, "Fuel Level", rental.checkinFuel, y);

  y += 4;
  y = section(doc, "Deposit Resolution", y);
  y = row(doc, "Deposit Amount", rental.depositAmount, y);
  y = row(doc, "Returned", rental.depositReturned ? "Yes" : "No", y);
  if (rental.depositDeduction) y = row(doc, "Deduction", rental.depositDeduction, y);

  // Pre-existing damages (from hand-over) for reference
  if ((rental.checkoutDamages ?? []).length > 0) {
    y += 4;
    y = damageSection(doc, "Pre-Existing Damage (Hand-Over Reference)", rental.checkoutDamages ?? [], y);
  }

  // New damages found at return
  y += 4;
  y = damageSection(doc, "New Damage Found at Return", rental.checkinDamages ?? [], y);

  footer(doc);
  return doc;
}

function damageSection(doc: jsPDF, title: string, damages: Damage[], y: number): number {
  y = section(doc, title, y);

  if (damages.length === 0) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text("No damage documented.", 15, y);
    return y + 8;
  }

  const byView = damages.reduce<Record<string, Damage[]>>((acc, d) => {
    if (!acc[d.view]) acc[d.view] = [];
    acc[d.view].push(d);
    return acc;
  }, {});

  for (const [viewKey, viewDamages] of Object.entries(byView)) {
    y = checkNewPage(doc, y, 15);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(50, 50, 50);
    const viewLabel = VIEW_LABELS[viewKey] ?? viewKey;
    doc.text(`${viewLabel} — ${viewDamages.length} damage${viewDamages.length !== 1 ? "s" : ""}`, 15, y);
    y += 6;

    for (let i = 0; i < viewDamages.length; i++) {
      const d = viewDamages[i];
      y = checkNewPage(doc, y, 10);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text(`${i + 1}.  ${new Date(d.date).toLocaleString("de-DE")}`, 20, y);
      y += 5;

      if (d.desc) {
        y = checkNewPage(doc, y, 8);
        doc.setTextColor(30, 30, 30);
        const lines = doc.splitTextToSize(d.desc, 160);
        doc.text(lines, 20, y);
        y += lines.length * 4.5 + 2;
      }

      if (d.photos.length > 0) {
        let col = 0;
        for (const photo of d.photos) {
          y = checkNewPage(doc, y, 42);
          const x = 20 + col * 50;
          try { doc.addImage(photo, "JPEG", x, y, 45, 30); } catch {}
          col++;
          if (col >= 3) { col = 0; y += 34; }
        }
        if (col > 0) y += 34;
      }

      y += 3;
    }
    y += 4;
  }

  return y;
}

function section(doc: jsPDF, title: string, y: number): number {
  y = checkNewPage(doc, y, 20);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(27, 42, 74);
  doc.text(title, 15, y);
  doc.setDrawColor(27, 42, 74);
  doc.line(15, y + 1.5, 195, y + 1.5);
  return y + 8;
}

function row(doc: jsPDF, label: string, value: string, y: number): number {
  y = checkNewPage(doc, y, 8);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(100, 100, 100);
  doc.text(label, 15, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 30, 30);
  const lines = doc.splitTextToSize(value || "-", 100);
  doc.text(lines, 95, y);
  return y + Math.max(lines.length * 4.5, 6);
}

function checkNewPage(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > 280) { doc.addPage(); return 20; }
  return y;
}

function footer(doc: jsPDF): void {
  const w = doc.internal.pageSize.getWidth();
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text("Sommarbukt - 9030 Sjursnes, Troms, Norway - sommarbukt.com", w / 2, 290, { align: "center" });
  }
}
