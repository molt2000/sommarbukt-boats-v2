"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { getRental, deleteRental } from "@/lib/storage";
import { Rental } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { generateRentalPDF, generateReturnPDF } from "@/lib/pdf";
import Button from "@/components/ui/button";
import { ArrowLeft, Ship, User, Shield, Camera, CreditCard, FileSignature, Download, Send, CornerDownRight, Trash2 } from "lucide-react";

export default function RentalDetail() {
  const router = useRouter();
  const params = useParams();
  const [rental, setRental] = useState<Rental | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const r = getRental(params.id as string);
    if (!r) { router.push("/"); return; }
    setRental(r);
  }, [params.id, router]);

  if (!rental) return null;

  const downloadRentalPDF = () => {
    const doc = generateRentalPDF(rental);
    doc.save(`rental-${rental.guestName.replace(/\s+/g, "-")}-${rental.id.slice(0, 8)}.pdf`);
  };

  const downloadReturnPDF = () => {
    const doc = generateReturnPDF(rental);
    doc.save(`return-${rental.guestName.replace(/\s+/g, "-")}-${rental.id.slice(0, 8)}.pdf`);
  };

  const sendPDF = async (type: "rental" | "return") => {
    if (!rental.guestEmail) return;
    setSending(true);
    try {
      const doc = type === "rental" ? generateRentalPDF(rental) : generateReturnPDF(rental);
      const blob = doc.output("blob");
      const buf = await blob.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: rental.guestEmail,
          subject: type === "rental"
            ? `Your Sommarbukt Boat Rental Agreement — ${rental.boatName}`
            : `Your Sommarbukt Boat Return Report — ${rental.boatName}`,
          html: `<p>Dear ${rental.guestName},</p><p>Please find your ${type === "rental" ? "rental agreement" : "return report"} attached.</p><p>Thank you for choosing Sommarbukt!<br>Sommarbukt Team</p>`,
          pdfBase64: base64,
          pdfFilename: `sommarbukt-${type}-${rental.id.slice(0, 8)}.pdf`,
        }),
      });
      if (res.ok) setSent(true); else throw new Error("Failed");
    } catch { alert("Could not send email. Download the PDF and share manually."); }
    setSending(false);
  };

  const handleDelete = () => {
    if (confirm("Delete this rental permanently?")) {
      deleteRental(rental.id);
      router.push("/");
    }
  };

  return (
    <div className="py-6 space-y-6 pb-24">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push("/")} className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center"><ArrowLeft className="w-5 h-5" /></button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{rental.guestName}</h1>
          <p className="text-sm text-gray-500">{rental.boatName} · {formatDate(rental.createdAt)}</p>
        </div>
        <span className={`text-xs font-medium px-3 py-1 rounded-full ${rental.status === "active" ? "bg-blue-50 text-blue-600" : "bg-green-50 text-green-600"}`}>
          {rental.status}
        </span>
      </div>

      {/* Info cards */}
      <Card icon={<User className="w-5 h-5" />} title="Guest">
        <Row label="Phone" value={rental.guestPhone} />
        <Row label="Email" value={rental.guestEmail} />
        <Row label="Nationality" value={rental.nationality} />
        <Row label="ID" value={rental.idNumber} />
        <Row label="Passengers" value={String(rental.passengerCount)} />
        <Row label="Licence" value={rental.hasLicence ? rental.licenceNumber || "Yes" : "No"} />
        {rental.idPhotoData && <img src={rental.idPhotoData} alt="ID" className="mt-3 rounded-lg w-full max-w-xs" />}
      </Card>

      <Card icon={<Ship className="w-5 h-5" />} title="Rental">
        <Row label="Boat" value={rental.boatName} />
        <Row label="Type" value={rental.rentalType} />
        <Row label="Out" value={formatDate(rental.checkoutTime)} />
        <Row label="Expected" value={formatDate(rental.expectedReturn)} />
        {rental.actualReturn && <Row label="Returned" value={formatDate(rental.actualReturn)} />}
      </Card>

      <Card icon={<Shield className="w-5 h-5" />} title="Safety Checklist">
        {Object.entries(rental.safetyChecklist).map(([item, ok]) => (
          <div key={item} className="flex items-center gap-2 py-1">
            <span className={ok ? "text-green-500" : "text-red-500"}>{ok ? "✓" : "✗"}</span>
            <span className="text-sm">{item}</span>
          </div>
        ))}
      </Card>

      <Card icon={<Camera className="w-5 h-5" />} title="Check-Out Photos">
        <Row label="Fuel" value={rental.checkoutFuel} />
        <Row label="Condition" value={rental.checkoutCondition} />
        {rental.checkoutDamageNotes && <Row label="Notes" value={rental.checkoutDamageNotes} />}
        <div className="grid grid-cols-3 gap-2 mt-3">
          {rental.checkoutPhotos.map((p, i) => (
            <div key={i} className="relative rounded-lg overflow-hidden">
              <img src={p.dataUrl} alt={p.label} className="w-full h-24 object-cover" />
              <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[10px] px-1 py-0.5">{p.label}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card icon={<CreditCard className="w-5 h-5" />} title="Payment">
        <Row label="Fee" value={rental.rentalFee} />
        <Row label="Deposit" value={rental.depositAmount} />
        <Row label="Method" value={rental.paymentMethod} />
        <Row label="Paid" value={rental.paymentReceived ? "✓ Yes" : "✗ No"} />
        <Row label="Deposit held" value={rental.depositReceived ? "✓ Yes" : "✗ No"} />
        {rental.status === "completed" && <Row label="Deposit returned" value={rental.depositReturned ? "✓ Yes" : "✗ No"} />}
      </Card>

      <Card icon={<FileSignature className="w-5 h-5" />} title="Signature">
        {rental.signatureData && <img src={rental.signatureData} alt="Signature" className="h-20 mt-2" />}
        <div className="mt-2 text-sm text-gray-500">{rental.guestName} — {formatDate(rental.createdAt)}</div>
      </Card>

      {/* Return photos if completed */}
      {rental.status === "completed" && rental.checkinPhotos.length > 0 && (
        <Card icon={<Camera className="w-5 h-5" />} title="Return Photos">
          <Row label="Fuel" value={rental.checkinFuel} />
          <Row label="Condition" value={rental.checkinCondition} />
          <Row label="Damage" value={rental.damageFound ? "YES" : "No"} />
          {rental.checkinDamageNotes && <Row label="Notes" value={rental.checkinDamageNotes} />}
          <div className="grid grid-cols-3 gap-2 mt-3">
            {rental.checkinPhotos.map((p, i) => (
              <div key={i} className="relative rounded-lg overflow-hidden">
                <img src={p.dataUrl} alt={p.label} className="w-full h-24 object-cover" />
                <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[10px] px-1 py-0.5">{p.label}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Actions */}
      <div className="space-y-3">
        {rental.status === "active" && (
          <Button size="lg" onClick={() => router.push(`/rental/${rental.id}/return`)}>
            <CornerDownRight className="w-5 h-5 mr-2" /> Start Return Check-In
          </Button>
        )}

        <Button size="lg" variant="secondary" onClick={downloadRentalPDF}>
          <Download className="w-5 h-5 mr-2" /> Download Rental PDF
        </Button>

        {rental.status === "completed" && (
          <Button size="lg" variant="secondary" onClick={downloadReturnPDF}>
            <Download className="w-5 h-5 mr-2" /> Download Return PDF
          </Button>
        )}

        {rental.guestEmail && (
          <Button size="lg" variant="secondary" onClick={() => sendPDF(rental.status === "completed" ? "return" : "rental")} disabled={sending || sent}>
            <Send className="w-5 h-5 mr-2" /> {sent ? "Sent ✓" : sending ? "Sending..." : "Email PDF to Guest"}
          </Button>
        )}

        <Button size="lg" variant="danger" onClick={handleDelete}>
          <Trash2 className="w-5 h-5 mr-2" /> Delete Rental
        </Button>
      </div>
    </div>
  );
}

function Card({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-100 p-5">
      <div className="flex items-center gap-2 mb-3 text-brand">
        {icon}
        <h3 className="font-semibold">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-right">{value || "—"}</span>
    </div>
  );
}
