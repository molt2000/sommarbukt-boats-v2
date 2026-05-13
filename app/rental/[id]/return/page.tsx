"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { getRental, saveRental } from "@/lib/storage";
import { Rental, PHOTO_ANGLES, FUEL_LEVELS } from "@/lib/types";
import { blobToBase64, escapeHtml, formatDate, getErrorMessage } from "@/lib/utils";
import { generateReturnPDF } from "@/lib/pdf";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import Select from "@/components/ui/select";
import Field from "@/components/ui/field";
import Checkbox from "@/components/ui/checkbox";
import PhotoCapture from "@/components/photo-capture";
import { ArrowLeft, ArrowRight, Camera, CheckCircle, Check, Download, Send } from "lucide-react";

export default function ReturnWizard() {
  const router = useRouter();
  const params = useParams();
  const [rental, setRental] = useState<Rental | null>(null);
  const [step, setStep] = useState(0);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    try {
      const r = getRental(params.id as string);
      if (!r || r.status !== "active") { router.push("/"); return; }
      setRental(r);
    } catch (error) {
      alert(getErrorMessage(error));
      router.push("/");
    }
  }, [params.id, router]);

  if (!rental) return null;

  const update = (patch: Partial<Rental>) => setRental(prev => prev ? { ...prev, ...patch } : prev);

  const canNext = (): boolean => {
    switch (step) {
      case 0: return rental.checkinPhotos.length >= 4 && !!rental.checkinFuel && !!rental.checkinCondition;
      case 1: return rental.depositReturned || !!rental.depositDeduction;
      default: return true;
    }
  };

  const complete = () => {
    const updated = { ...rental, status: "completed" as const, actualReturn: new Date().toISOString() };
    try {
      saveRental(updated);
      setRental(updated);
      const doc = generateReturnPDF(updated);
      setPdfBlob(doc.output("blob"));
      setStep(2);
    } catch (error) {
      alert(getErrorMessage(error));
    }
  };

  const downloadPDF = () => {
    if (!pdfBlob) return;
    const url = URL.createObjectURL(pdfBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `return-${rental.guestName.replace(/\s+/g, "-")}-${rental.id.slice(0, 8)}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sendEmail = async () => {
    if (!pdfBlob || !rental.guestEmail) return;
    setSending(true);
    try {
      const base64 = await blobToBase64(pdfBlob);
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: rental.guestEmail,
          subject: `Sommarbukt Boat Return Report - ${rental.boatName}`,
          html: `<p>Dear ${escapeHtml(rental.guestName)},</p><p>Your boat has been returned. Please find the return report attached.</p><p>Thank you for choosing Sommarbukt!<br>Sommarbukt Team</p>`,
          pdfBase64: base64,
          pdfFilename: `sommarbukt-return-${rental.id.slice(0, 8)}.pdf`,
        }),
      });
      if (res.ok) setSent(true);
      else {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Email could not be sent.");
      }
    } catch (error) {
      alert(getErrorMessage(error));
    }
    setSending(false);
  };

  return (
    <div className="py-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => step === 0 ? router.back() : setStep(s => s - 1)} className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold">Return — {rental.guestName}</h1>
          {step < 2 && <p className="text-sm text-gray-500">Step {step + 1} of 2</p>}
        </div>
      </div>

      {step < 2 && (
        <div className="flex gap-1.5 mb-8">
          {[0, 1].map(i => <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-brand" : "bg-gray-200"}`} />)}
        </div>
      )}

      <div className="step-enter">
        {step === 0 && (
          <div className="space-y-5 pb-24">
            <p className="text-sm text-gray-500">Take return photos and check condition. At least 4 required.</p>

            <PhotoCapture labels={PHOTO_ANGLES} photos={rental.checkinPhotos} onChange={photos => update({ checkinPhotos: photos })} />

            <Field label="Fuel Level">
              <Select value={rental.checkinFuel} onChange={e => update({ checkinFuel: e.target.value })}>
                <option value="">Select...</option>
                {FUEL_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
              </Select>
            </Field>

            <Field label="Condition">
              <Select value={rental.checkinCondition} onChange={e => update({ checkinCondition: e.target.value })}>
                <option value="">Select...</option>
                <option value="Good">Good — no issues</option>
                <option value="Minor wear">Minor wear</option>
                <option value="Damage found">Damage found</option>
              </Select>
            </Field>

            <Checkbox checked={rental.damageFound} onChange={v => update({ damageFound: v })} label="Damage found during return inspection" />

            {rental.damageFound && (
              <Field label="Damage Description">
                <textarea
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-base focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                  rows={3}
                  value={rental.checkinDamageNotes}
                  onChange={e => update({ checkinDamageNotes: e.target.value })}
                  placeholder="Describe the damage..."
                />
              </Field>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5 pb-24">
            <p className="text-sm text-gray-500">Resolve the security deposit.</p>

            <div className="p-4 bg-gray-50 rounded-xl">
              <div className="text-sm text-gray-500">Deposit held</div>
              <div className="text-xl font-bold">{rental.depositAmount || "—"}</div>
            </div>

            {!rental.damageFound ? (
              <Checkbox checked={rental.depositReturned} onChange={v => update({ depositReturned: v })} label="Full deposit returned to guest" required />
            ) : (
              <div className="space-y-4">
                <Field label="Deduction Amount">
                  <Input value={rental.depositDeduction} onChange={e => update({ depositDeduction: e.target.value })} placeholder="e.g. 1500 NOK" />
                </Field>
                <Checkbox checked={rental.depositReturned} onChange={v => update({ depositReturned: v })} label="Remaining deposit returned" />
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="text-center py-8 space-y-6">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Return Complete</h2>
              <p className="text-gray-500 mt-1">{rental.guestName} — {rental.boatName}</p>
              <p className="text-sm text-gray-400 mt-1">Returned {formatDate(rental.actualReturn)}</p>
            </div>
            <div className="space-y-3 max-w-sm mx-auto">
              <Button size="lg" onClick={downloadPDF}><Download className="w-5 h-5 mr-2" /> Download Return PDF</Button>
              {rental.guestEmail && (
                <Button size="lg" variant={sent ? "secondary" : "primary"} onClick={sendEmail} disabled={sending || sent}>
                  <Send className="w-5 h-5 mr-2" /> {sent ? "Sent ✓" : sending ? "Sending..." : `Email to ${rental.guestEmail}`}
                </Button>
              )}
              <Button size="lg" variant="secondary" onClick={() => router.push("/")}>Back to Dashboard</Button>
            </div>
          </div>
        )}
      </div>

      {step < 2 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4">
          <div className="max-w-3xl mx-auto flex gap-3">
            {step > 0 && (
              <Button variant="secondary" size="lg" onClick={() => setStep(s => s - 1)} className="w-auto px-6">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
              </Button>
            )}
            {step < 1 ? (
              <Button size="lg" onClick={() => setStep(1)} disabled={!canNext()} className="flex-1">
                Next <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button size="lg" onClick={complete} disabled={!canNext()} className="flex-1">
                Complete Return <Check className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
