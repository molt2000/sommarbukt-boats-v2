"use client";
import { useState, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Rental, RENTAL_TERMS, SAFETY_ITEMS, FUEL_LEVELS, newRental } from "@/lib/types";
import { saveRental, getRentals, getBoatDamages, getBoats } from "@/lib/storage";
import { blobToBase64, escapeHtml, formatDate, getErrorMessage, isValidEmail } from "@/lib/utils";
import { readAndCompressImage } from "@/lib/image";
import { generateRentalPDF } from "@/lib/pdf";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import Select from "@/components/ui/select";
import Field from "@/components/ui/field";
import Checkbox from "@/components/ui/checkbox";
import SignaturePad from "@/components/signature-pad";
import DamageReport from "@/components/damage-report";
import { ArrowLeft, ArrowRight, User, Ship, Shield, AlertCircle, CreditCard, FileSignature, Check, Send, Download, Camera } from "lucide-react";

const STEPS = [
  { title: "Guest", icon: User },
  { title: "Rental", icon: Ship },
  { title: "Safety Check", icon: Shield },
  { title: "Condition", icon: AlertCircle },
  { title: "Deposit", icon: CreditCard },
  { title: "Signature", icon: FileSignature },
  { title: "Done", icon: Check },
];


export default function RentalWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [rental, setRental] = useState<Rental>(newRental());
  const [boats, setBoats] = useState<{id:string;name:string;available:boolean}[]>([]);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);

  useEffect(() => {
  try {
    const allBoats = getBoats();

    const storedRentals = getRentals();

    const activeBoatIds = new Set(
      storedRentals
        .filter(r => r.status === "active")
        .map(r => r.boatId)
        .filter(Boolean)
    );

    const boatsWithAvailability = allBoats.map(b => ({
      ...b,
      available: !activeBoatIds.has(b.id),
    }));

    setBoats(boatsWithAvailability);
  } catch (error) {
    alert(getErrorMessage(error));
  }
}, []);


  const update = useCallback((patch: Partial<Rental>) => {
    setRental(prev => ({ ...prev, ...patch }));
  }, []);

  const updateChecklist = useCallback((item: string, val: boolean) => {
    setRental(prev => ({ ...prev, safetyChecklist: { ...prev.safetyChecklist, [item]: val } }));
  }, []);

  const boatDamages = useMemo(
    () => (rental.boatId ? getBoatDamages(rental.boatId) : []),
    [rental.boatId]
  );

  const canNext = (): boolean => {
    switch (step) {
      case 0: return !!(rental.guestName && rental.guestPhone && isValidEmail(rental.guestEmail) && rental.idPhotoData && (rental.bornBefore1980 || rental.licenceNumber));
      case 1: return !!(rental.boatId && rental.returnDate && rental.returnDate > rental.checkoutDate);
      case 2: return true;
      case 3: return true;
      case 4: return !!(rental.depositAmount && rental.depositReceived);
      case 5: return !!rental.signatureData;
      default: return true;
    }
  };

  const complete = () => {
    try {
      const doc = generateRentalPDF(rental, RENTAL_TERMS);
      const arrayBuffer = doc.output("arraybuffer");
      const blob = new Blob([arrayBuffer], { type: "application/pdf" });
      saveRental(rental);
      setPdfBlob(blob);
      setStep(6);
    } catch (err) {
      console.error("Could not complete rental:", err);
      alert(getErrorMessage(err));
    }
  };

  const downloadPDF = () => {
    if (!pdfBlob) return;
    const url = URL.createObjectURL(pdfBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sommarbukt-handover-${rental.guestName.replace(/\s+/g, "-").toLowerCase()}-${rental.id.slice(0, 8)}.pdf`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const sendEmail = async () => {
    if (!pdfBlob || !rental.guestEmail) return;
    setSending(true);
    try {
      const base64 = await blobToBase64(pdfBlob);
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-token": process.env.NEXT_PUBLIC_API_TOKEN ?? "" },
        body: JSON.stringify({
          to: rental.guestEmail,
          subject: `Sommarbukt Boat Rental Agreement - ${rental.boatName}`,
          html: `<p>Dear ${escapeHtml(rental.guestName)},</p><p>Thank you for renting with Sommarbukt. Please find your rental agreement attached.</p><p>Boat: ${escapeHtml(rental.boatName)}<br>Hand-Over: ${escapeHtml(formatDate(rental.checkoutDate))}<br>Return Date: ${escapeHtml(formatDate(rental.returnDate))}</p><p>Have a great time on the water!<br>Sommarbukt Team</p>`,
          pdfBase64: base64,
          pdfFilename: `sommarbukt-handover-${rental.id.slice(0, 8)}.pdf`,
        }),
      });
      if (res.ok) setSent(true);
      else {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Email could not be sent.");
      }
    } catch (e) {
      alert(`${getErrorMessage(e)} You can still download the PDF and share it manually.`);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => step === 0 ? router.push("/") : setStep(s => s - 1)} className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center transition">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">New Rental</h1>
          {step < 6 && <p className="text-sm text-gray-500">Step {step + 1} of 6 — {STEPS[step].title}</p>}
        </div>
      </div>

      {/* Progress */}
      {step < 6 && (
        <div className="flex gap-1.5 mb-8">
          {STEPS.slice(0, 6).map((_, i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full transition-all ${i <= step ? "bg-brand" : "bg-gray-200"}`} />
          ))}
        </div>
      )}

      {/* Steps */}
      <div className="step-enter">
        {step === 0 && <StepGuest rental={rental} update={update} />}
        {step === 1 && <StepRental rental={rental} update={update} boats={boats} />}
        {step === 2 && <StepSafety rental={rental} updateChecklist={updateChecklist} />}
        {step === 3 && <StepCondition rental={rental} update={update} boatDamages={boatDamages} />}
        {step === 4 && <StepPayment rental={rental} update={update} />}
        {step === 5 && <StepSign rental={rental} update={update} terms={RENTAL_TERMS} />}
        {step === 6 && <StepDone rental={rental} downloadPDF={downloadPDF} sendEmail={sendEmail} sending={sending} sent={sent} />}
      </div>

      {/* Navigation */}
      {step < 6 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4">
          <div className="max-w-3xl mx-auto flex gap-3">
            {step > 0 && (
              <Button variant="secondary" size="lg" onClick={() => setStep(s => s - 1)} className="w-auto px-6">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
              </Button>
            )}
            {step < 5 ? (
              <Button size="lg" onClick={() => setStep(s => s + 1)} disabled={!canNext()} className="flex-1">
                Next <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button size="lg" onClick={complete} disabled={!canNext()} className="flex-1">
                Complete Rental <Check className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Step Components ─── */

function StepGuest({ rental, update }: { rental: Rental; update: (p: Partial<Rental>) => void }) {
  return (
    <div className="space-y-5 pb-24">
      <p className="text-sm text-gray-500">Take a photo of the guest's ID — that covers name and address. Just add phone and email.</p>

      {/* ID Photo Front */}
      <div>
        <label className="block text-sm font-medium text-gray-600 mb-2">ID / Passport Photo — Front *</label>
        {rental.idPhotoData ? (
          <div className="relative rounded-xl overflow-hidden border border-gray-200">
            <img src={rental.idPhotoData} alt="ID Front" className="w-full h-48 object-cover" />
            <button
              onClick={() => update({ idPhotoData: "" })}
              className="absolute top-3 right-3 px-3 py-1.5 bg-black/60 text-white text-sm rounded-lg"
            >
              Retake
            </button>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center h-40 rounded-xl border-2 border-dashed border-brand/30 bg-brand/5 cursor-pointer hover:bg-brand/10 transition">
            <Camera className="w-8 h-8 text-brand mb-2" />
            <span className="text-brand font-medium">Tap to photograph ID front</span>
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={async e => {
              const file = e.target.files?.[0]; if (!file) return;
              update({ idPhotoData: await readAndCompressImage(file, { maxSize: 1000, quality: 0.72 }) });
            }} />
          </label>
        )}
      </div>

      {/* ID Photo Back */}
      <div>
        <label className="block text-sm font-medium text-gray-600 mb-2">ID Photo — Back <span className="text-gray-400 font-normal">(optional, recommended for ID cards)</span></label>
        {rental.idPhotoDataBack ? (
          <div className="relative rounded-xl overflow-hidden border border-gray-200">
            <img src={rental.idPhotoDataBack} alt="ID Back" className="w-full h-48 object-cover" />
            <button
              onClick={() => update({ idPhotoDataBack: "" })}
              className="absolute top-3 right-3 px-3 py-1.5 bg-black/60 text-white text-sm rounded-lg"
            >
              Retake
            </button>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center h-40 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 cursor-pointer hover:bg-gray-100 transition">
            <Camera className="w-8 h-8 text-gray-400 mb-2" />
            <span className="text-gray-500 font-medium">Tap to photograph ID back</span>
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={async e => {
              const file = e.target.files?.[0]; if (!file) return;
              update({ idPhotoDataBack: await readAndCompressImage(file, { maxSize: 1000, quality: 0.72 }) });
            }} />
          </label>
        )}
      </div>

      <Field label="Full Name *">
        <Input value={rental.guestName} onChange={e => update({ guestName: e.target.value })} placeholder="As on ID" />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Phone *">
          <Input type="tel" value={rental.guestPhone} onChange={e => update({ guestPhone: e.target.value })} placeholder="+49..." />
        </Field>
        <Field label="Email *">
          <Input type="email" value={rental.guestEmail} onChange={e => update({ guestEmail: e.target.value })} placeholder="guest@email.com" />
          {rental.guestEmail && !isValidEmail(rental.guestEmail) && (
            <p className="mt-1 text-xs text-red-500">Enter a valid guest email address.</p>
          )}
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Nationality">
          <Input value={rental.nationality} onChange={e => update({ nationality: e.target.value })} placeholder="e.g. German" />
        </Field>
        <Field label="ID Number" optional>
          <Input value={rental.idNumber} onChange={e => update({ idNumber: e.target.value })} placeholder="Passport / ID no." />
        </Field>
      </div>

      <Field label="Passengers (including renter)">
        <div className="flex items-center gap-4">
          <button className="w-12 h-12 rounded-xl border border-gray-200 text-xl font-bold hover:bg-gray-100 transition" onClick={() => update({ passengerCount: Math.max(1, rental.passengerCount - 1) })}>−</button>
          <span className="text-2xl font-bold w-10 text-center">{rental.passengerCount}</span>
          <button className="w-12 h-12 rounded-xl border border-gray-200 text-xl font-bold hover:bg-gray-100 transition" onClick={() => update({ passengerCount: Math.min(4, rental.passengerCount + 1) })}>+</button>
        </div>
      </Field>

      <Checkbox
        checked={rental.bornBefore1980}
        onChange={v => update({ bornBefore1980: v })}
        label="Born before 1980 (no licence required under Norwegian law)"
      />

      <Field label="Boat Licence & Open Sea">
        <Input
          value={rental.licenceNumber}
          onChange={e => update({ licenceNumber: e.target.value, hasLicence: e.target.value.length > 0 })}
          placeholder="Licence number (leave blank if none)"
        />
      </Field>

      {!rental.bornBefore1980 && !rental.licenceNumber && (
        <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
          Either tick "Born before 1980" or enter a boat licence number to continue.
        </p>
      )}
    </div>
  );
}

function StepRental({ rental, update, boats }: { rental: Rental; update: (p: Partial<Rental>) => void; boats: {id:string;name:string;available:boolean}[] }) {
  return (
    <div className="space-y-5 pb-24">
      <Field label="Boat *">
        <Select value={rental.boatId} onChange={e => {
          const boat = boats.find(b => b.id === e.target.value);
          update({ boatId: e.target.value, boatName: boat?.name || "" });
        }}>
          <option value="">Select boat...</option>
          {boats
  .filter(b => b.available)
  .map(b => (
    <option key={b.id} value={b.id}>
      {b.name}
    </option>
  ))}
        </Select>
      </Field>

      <Field label="Hand-Over Date & Time">
        <Input type="datetime-local" value={rental.checkoutDate} onChange={e => update({ checkoutDate: e.target.value })} />
      </Field>

      <Field label="Return Date *">
        <Input type="datetime-local" value={rental.returnDate} onChange={e => update({ returnDate: e.target.value })} />
      </Field>
    </div>
  );
}

function StepSafety({ rental, updateChecklist }: { rental: Rental; updateChecklist: (item: string, val: boolean) => void }) {
  const allChecked = Object.values(rental.safetyChecklist).every(Boolean);
  return (
    <div className="space-y-2 pb-24">
      <p className="text-sm text-gray-500 mb-4">Check each item with the guest before departure.</p>
      {SAFETY_ITEMS.map(item => (
        <Checkbox key={item} checked={rental.safetyChecklist[item] || false} onChange={v => updateChecklist(item, v)} label={item} />
      ))}
      {allChecked && (
        <div className="mt-4 p-3 rounded-xl bg-green-50 text-green-700 text-sm font-medium text-center">✓ All safety items confirmed</div>
      )}
    </div>
  );
}

function StepCondition({ rental, update, boatDamages }: { rental: Rental; update: (p: Partial<Rental>) => void; boatDamages: import("@/lib/types").Damage[] }) {
  return (
    <div className="space-y-5 pb-24">
      <p className="text-sm text-gray-500">Document any pre-existing damage and log the current fuel level.</p>
      <DamageReport
        existingDamages={boatDamages}
        boatId={rental.boatId}
        damages={rental.checkoutDamages}
        onChange={(damages) => update({ checkoutDamages: damages })}
      />
      <Field label="Fuel Level">
        <Select value={rental.checkoutFuel} onChange={e => update({ checkoutFuel: e.target.value })}>
          {FUEL_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
        </Select>
      </Field>
    </div>
  );
}

function StepPayment({ rental, update }: { rental: Rental; update: (p: Partial<Rental>) => void }) {
  return (
    <div className="space-y-5 pb-24">
      <p className="text-sm text-gray-500">Record the rental fee and confirm the security deposit has been received.</p>

      <Field label="Rental Fee" optional>
        <Input value={rental.rentalFee} onChange={e => update({ rentalFee: e.target.value })} placeholder="e.g. 3100 NOK" />
      </Field>

      <Field label="Security Deposit">
        <Select value={rental.depositAmount} onChange={e => update({ depositAmount: e.target.value })}>
          <option value="">Select deposit amount...</option>
          <option value="5000 NOK">5 000 NOK</option>
          <option value="10000 NOK">10 000 NOK</option>
        </Select>
      </Field>

      <div className="space-y-1 mt-4 p-4 bg-gray-50 rounded-xl">
        <Checkbox checked={rental.depositReceived} onChange={v => update({ depositReceived: v })} label="Security deposit received" />
      </div>
    </div>
  );
}

function StepSign({ rental, update, terms }: { rental: Rental; update: (p: Partial<Rental>) => void; terms: string }) {
  const [showFullContract, setShowFullContract] = useState(false);

  return (
    <div className="space-y-5 pb-24">
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-600">Rental Terms & Conditions</label>
          <button
            onClick={() => setShowFullContract(true)}
            className="text-xs text-brand font-medium underline"
          >
            View full screen
          </button>
        </div>
        <div className="max-h-48 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700 whitespace-pre-line">
          {terms}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-600 mb-2">Guest Signature *</label>
        <SignaturePad value={rental.signatureData} onChange={sig => update({ signatureData: sig })} />
      </div>

      {showFullContract && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white sticky top-0">
            <span className="font-semibold text-base">Rental Terms & Conditions</span>
            <button
              onClick={() => setShowFullContract(false)}
              className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center text-xl font-bold text-gray-500"
            >
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-5 text-sm text-gray-700 whitespace-pre-line leading-relaxed">
            {terms}
          </div>
        </div>
      )}
    </div>
  );
}

function StepDone({ rental, downloadPDF, sendEmail, sending, sent }: {
  rental: Rental; downloadPDF: () => void; sendEmail: () => void; sending: boolean; sent: boolean;
}) {
  return (
    <div className="text-center py-8 space-y-6">
      <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto">
        <Check className="w-10 h-10 text-green-600" size={40} />
      </div>
      <div>
        <h2 className="text-2xl font-bold">Rental Complete</h2>
        <p className="text-gray-500 mt-1">{rental.guestName} — {rental.boatName}</p>
      </div>

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
    </div>
  );
}

/* ─── Helpers ─── */
