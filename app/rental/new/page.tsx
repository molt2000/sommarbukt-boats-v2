"use client";
import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Rental, getBoats, getTerms, SAFETY_ITEMS, PHOTO_ANGLES, FUEL_LEVELS, newRental } from "@/lib/types";
import { saveRental, getRentals } from "@/lib/storage";
import { blobToBase64, escapeHtml, formatDate, getErrorMessage, isValidEmail } from "@/lib/utils";
import { readAndCompressImage } from "@/lib/image";
import { generateRentalPDF } from "@/lib/pdf";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import Select from "@/components/ui/select";
import Field from "@/components/ui/field";
import Checkbox from "@/components/ui/checkbox";
import PhotoCapture from "@/components/photo-capture";
import SignaturePad from "@/components/signature-pad";
import { ArrowLeft, ArrowRight, User, Ship, Shield, Camera, CreditCard, FileSignature, Check, Send, Download } from "lucide-react";

const STEPS = [
  { title: "Guest", icon: User },
  { title: "Rental", icon: Ship },
  { title: "Safety", icon: Shield },
  { title: "Photos", icon: Camera },
  { title: "Payment", icon: CreditCard },
  { title: "Sign", icon: FileSignature },
  { title: "Done", icon: Check },
];

const FALLBACK_TERMS = `BOAT RENTAL AGREEMENT
SOMMARBUKT BOAT RENTAL
9030 Sjursnes, Troms, Norway



1. PARTIES

Lessor:
Sommarbukt Boat Rental, 9030 Sjursnes, Troms, Norway

Renter: As stated on ID provided at handover


2. RENTAL OBJECT

The boat is rented in the condition the renter has personally inspected and approved at handover. Any pre-existing damage has been noted in this agreement.


3. RENTER'S RESPONSIBILITY

3.1 The renter is fully responsible for the boat, all equipment on board, and all persons on board from the moment of handover until the boat is returned to Sommarbukt.

3.2 The renter shall operate the boat carefully and in accordance with all applicable maritime laws and regulations.

3.3 The renter confirms having sufficient experience and knowledge to operate the boat safely and responsibly.

3.4 A boat licence is required where Norwegian law mandates it. The renter confirms compliance with all applicable licensing requirements.


4. SAFETY

4.1 Life jackets must be worn by all persons on board at all times when on open water.

4.2 Operating the boat under the influence of alcohol or drugs is strictly prohibited and will result in immediate termination of this agreement without refund.

4.3 Speed limits in harbours, near shore, and in all regulated zones must be observed at all times.

4.4 The maximum passenger capacity as indicated on the boat must never be exceeded.

4.5 The boat must not be used in bad weather, strong winds (above Beaufort 5), or any conditions that pose a safety risk to those on board or others.


5. DAMAGE AND LIABILITY

5.1 The renter is fully financially responsible for all damage caused to the boat or its equipment during the rental period, except for documented technical defects that were present and noted at handover.

5.2 Any damage must be reported to Sommarbukt immediately. Failure to report damage may result in extended liability.

5.3 The security deposit is retained until the boat has been returned and inspected. In the event of damage, the deposit may be used to cover repair costs.

5.4 If the cost of repair exceeds the deposit amount, the renter is liable for the full outstanding amount.

5.5 Sommarbukt is not liable for any personal injury, loss of personal belongings, or third-party damage arising during the rental period.


6. RETURN

6.1 The boat must be returned to Sommarbukt at the agreed time and location.

6.2 The boat must be returned with a full fuel tank unless otherwise agreed in writing at the time of handover.

6.3 The boat must be returned in the same condition as at handover — clean and with all equipment on board.

6.4 Late returns will be charged at the applicable hourly rate per commenced hour, without prior notice.


7. CANCELLATION

7.1 Cancellation more than 48 hours before departure: Full refund of rental fee. Deposit returned in full.

7.2 Cancellation between 24 and 48 hours before departure: 50% refund of rental fee. Deposit returned in full.

7.3 Cancellation less than 24 hours before departure or no-show: No refund. Deposit returned in full.

7.4 Sommarbukt reserves the right to cancel any rental for safety reasons — including adverse weather or technical failure — without liability. A full refund will be issued in such cases.


8. EMERGENCIES

In case of emergency at sea:

  Emergency Services: 112
  Sea Rescue (Redningsselskapet): 02016
  Coast Guard VHF: Channel 16
  Sommarbukt: +47 968 514 64


9. PRIVACY

Personal data collected in connection with this agreement is processed in accordance with Norwegian privacy legislation (GDPR) and will not be retained longer than necessary for the purpose for which it was collected.

10. DISPUTES

Any disputes shall first be sought resolved amicably between the parties. If no resolution can be reached, the legal venue is Troms District Court, Norway.

By signing below, the renter confirms having read, understood, and accepted all terms and conditions set out in this agreement.`;

export default function RentalWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [rental, setRental] = useState<Rental>(newRental());
  const [boats, setBoats] = useState<{id:string;name:string;available:boolean}[]>([]);
  const [rentalTerms, setRentalTerms] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);

  useEffect(() => {
  try {
    const allBoats = getBoats();

    // IMPORTANT: use the same storage source/key as the rest of the app
    const storedRentals = getRentals();

    const activeBoatIds = new Set(
      storedRentals
        .filter(r => String((r as any)?.status ?? "").toLowerCase() === "active")
        .map(r => (r as any)?.boatId)
        .filter(Boolean)
    );

    const boatsWithAvailability = allBoats.map(b => ({
      ...b,
      available: !activeBoatIds.has(b.id),
    }));

    setBoats(boatsWithAvailability);
    setRentalTerms(getTerms() || FALLBACK_TERMS);
  } catch (error) {
    alert(getErrorMessage(error));
    setRentalTerms(FALLBACK_TERMS);
  }
}, []);


  const update = useCallback((patch: Partial<Rental>) => {
    setRental(prev => ({ ...prev, ...patch }));
  }, []);

  const updateChecklist = useCallback((item: string, val: boolean) => {
    setRental(prev => ({ ...prev, safetyChecklist: { ...prev.safetyChecklist, [item]: val } }));
  }, []);

  const canNext = (): boolean => {
    switch (step) {
      case 0: return !!(rental.guestName && rental.guestPhone && isValidEmail(rental.guestEmail) && rental.idPhotoData);
      case 1: return !!(rental.boatId && rental.expectedReturn);
      case 2: return Object.values(rental.safetyChecklist).every(Boolean);
      case 3: return rental.checkoutPhotos.length >= 4;
      case 4: return rental.paymentReceived && rental.depositReceived;
      case 5: return rental.termsAccepted && rental.safetyBriefingDone && !!rental.signatureData;
      default: return true;
    }
  };

  const complete = () => {
  try {
    saveRental(rental);
    const doc = generateRentalPDF(rental, rentalTerms);
    const arrayBuffer = doc.output("arraybuffer");
    const blob = new Blob([arrayBuffer], { type: "application/pdf" });
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
    a.download = `sommarbukt-rental-${rental.guestName.replace(/\s+/g, "-").toLowerCase()}-${rental.id.slice(0, 8)}.pdf`;
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
          subject: `Sommarbukt Boat Rental Agreement - ${rental.boatName}`,
          html: `<p>Dear ${escapeHtml(rental.guestName)},</p><p>Thank you for renting with Sommarbukt. Please find your rental agreement attached.</p><p>Boat: ${escapeHtml(rental.boatName)}<br>Check-out: ${escapeHtml(formatDate(rental.checkoutTime))}<br>Expected return: ${escapeHtml(formatDate(rental.expectedReturn))}</p><p>Have a great time on the water!<br>Sommarbukt Team</p>`,
          pdfBase64: base64,
          pdfFilename: `sommarbukt-rental-${rental.id.slice(0, 8)}.pdf`,
        }),
      });
      if (res.ok) setSent(true);
      else {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Email could not be sent.");
      }
    } catch (e) {
      alert(`${getErrorMessage(e)} You can still download the PDF and share it manually.`);
    }
    setSending(false);
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
          {STEPS.slice(0, 6).map((s, i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full transition-all ${i <= step ? "bg-brand" : "bg-gray-200"}`} />
          ))}
        </div>
      )}

      {/* Steps */}
      <div className="step-enter">
        {step === 0 && <StepGuest rental={rental} update={update} />}
        {step === 1 && <StepRental rental={rental} update={update} boats={boats} />}
        {step === 2 && <StepSafety rental={rental} updateChecklist={updateChecklist} />}
        {step === 3 && <StepPhotos rental={rental} update={update} />}
        {step === 4 && <StepPayment rental={rental} update={update} />}
        {step === 5 && <StepSign rental={rental} update={update} terms={rentalTerms} />}
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
          <button className="w-12 h-12 rounded-xl border border-gray-200 text-xl font-bold hover:bg-gray-100 transition" onClick={() => update({ passengerCount: Math.min(8, rental.passengerCount + 1) })}>+</button>
        </div>
      </Field>

      <Checkbox checked={rental.hasLicence} onChange={v => update({ hasLicence: v })} label="Has boat licence" />

      {rental.hasLicence && (
        <Field label="Licence Number">
          <Input value={rental.licenceNumber} onChange={e => update({ licenceNumber: e.target.value })} placeholder="Licence no." />
        </Field>
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

      <Field label="Check-out Date & Time">
        <Input type="datetime-local" value={rental.checkoutTime} onChange={e => update({ checkoutTime: e.target.value })} />
      </Field>

      <Field label="Expected Return *">
        <Input type="datetime-local" value={rental.expectedReturn} onChange={e => update({ expectedReturn: e.target.value })} />
      </Field>
    </div>
  );
}

function StepSafety({ rental, updateChecklist }: { rental: Rental; updateChecklist: (item: string, val: boolean) => void }) {
  const allChecked = Object.values(rental.safetyChecklist).every(Boolean);
  return (
    <div className="space-y-2 pb-24">
      <p className="text-sm text-gray-500 mb-4">Check each item with the guest before departure. All items are required.</p>
      {SAFETY_ITEMS.map(item => (
        <Checkbox key={item} checked={rental.safetyChecklist[item] || false} onChange={v => updateChecklist(item, v)} label={item} required />
      ))}
      {allChecked && (
        <div className="mt-4 p-3 rounded-xl bg-green-50 text-green-700 text-sm font-medium text-center">✓ All safety items confirmed</div>
      )}
    </div>
  );
}

function StepPhotos({ rental, update }: { rental: Rental; update: (p: Partial<Rental>) => void }) {
  return (
    <div className="space-y-5 pb-24">
      <p className="text-sm text-gray-500">Take photos of the boat before departure. At least 4 photos required.</p>

      <PhotoCapture
        labels={PHOTO_ANGLES}
        photos={rental.checkoutPhotos}
        onChange={photos => update({ checkoutPhotos: photos })}
      />

      <Field label="Fuel Level">
        <Select value={rental.checkoutFuel} onChange={e => update({ checkoutFuel: e.target.value })}>
          {FUEL_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
        </Select>
      </Field>

      <Field label="Overall Condition">
        <Select value={rental.checkoutCondition} onChange={e => update({ checkoutCondition: e.target.value })}>
          <option value="Good">Good</option>
          <option value="Minor wear">Minor wear</option>
          <option value="Pre-existing damage">Pre-existing damage</option>
        </Select>
      </Field>

      <Field label="Existing Damage Notes" optional>
        <textarea
          className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-base focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 transition min-h-[100px]"
          rows={3}
          value={rental.checkoutDamageNotes}
          onChange={e => update({ checkoutDamageNotes: e.target.value })}
          placeholder="Note any pre-existing damage..."
        />
      </Field>

      <p className="text-xs text-gray-400">Photos: {rental.checkoutPhotos.length} / {PHOTO_ANGLES.length} — minimum 4 required</p>
    </div>
  );
}

function StepPayment({ rental, update }: { rental: Rental; update: (p: Partial<Rental>) => void }) {
  return (
    <div className="space-y-5 pb-24">
      <p className="text-sm text-gray-500">Confirm that payment and deposit have been received. Both must be checked to proceed.</p>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Rental Fee">
          <Input value={rental.rentalFee} onChange={e => update({ rentalFee: e.target.value })} placeholder="e.g. 3100 NOK" />
        </Field>
        <Field label="Deposit Amount">
          <Input value={rental.depositAmount} onChange={e => update({ depositAmount: e.target.value })} placeholder="e.g. 5000 NOK" />
        </Field>
      </div>

      <Field label="Payment Method">
        <Select value={rental.paymentMethod} onChange={e => update({ paymentMethod: e.target.value })}>
          <option value="Cash">Cash</option>
          <option value="Card">Card</option>
          <option value="Vipps">Vipps</option>
          <option value="Transfer">Bank Transfer</option>
        </Select>
      </Field>

      <div className="space-y-1 mt-4 p-4 bg-gray-50 rounded-xl">
        <Checkbox checked={rental.paymentReceived} onChange={v => update({ paymentReceived: v })} label="Payment received" required />
        <Checkbox checked={rental.depositReceived} onChange={v => update({ depositReceived: v })} label="Security deposit received" required />
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
          {terms || FALLBACK_TERMS}
        </div>
      </div>

      <Checkbox checked={rental.termsAccepted} onChange={v => update({ termsAccepted: v })} label="Guest has read and accepts the terms" required />
      <Checkbox checked={rental.safetyBriefingDone} onChange={v => update({ safetyBriefingDone: v })} label="Safety briefing completed" required />

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
            {terms || FALLBACK_TERMS}
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
          <Download className="w-5 h-5 mr-2" /> Download PDF
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
