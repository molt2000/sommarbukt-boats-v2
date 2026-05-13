"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getJsonItem, setJsonItem, setTextItem } from "@/lib/safe-storage";
import { getErrorMessage } from "@/lib/utils";

interface Boat {
  id: string;
  name: string;
  registration: string;
}

const DEFAULT_BOATS: Boat[] = [
  { id: "1", name: "Kaasboll 660 #1", registration: "" },
  { id: "2", name: "Kaasboll 660 #2", registration: "" },
  { id: "3", name: "Kaasboll 660 #3", registration: "" },
  { id: "4", name: "Kaasboll 660 #4", registration: "" },
];

const DEFAULT_TERMS = `BOAT RENTAL AGREEMENT
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

function loadBoats(): Boat[] {
  if (typeof window === "undefined") return DEFAULT_BOATS;
  return getJsonItem("sb_boats", DEFAULT_BOATS);
}

function loadTerms(): string {
  if (typeof window === "undefined") return DEFAULT_TERMS;
  return localStorage.getItem("sb_terms") || DEFAULT_TERMS;
}

function getBoats(): Boat[] { return loadBoats(); }
function getTerms(): string { return loadTerms(); }

export default function ConfigPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"boats" | "terms">("boats");
  const [boats, setBoats] = useState<Boat[]>([]);
  const [terms, setTerms] = useState("");
  const [saved, setSaved] = useState(false);
  const [newName, setNewName] = useState("");
  const [newReg, setNewReg] = useState("");

  useEffect(() => {
    try {
      setBoats(loadBoats());
      setTerms(loadTerms());
    } catch (error) {
      alert(getErrorMessage(error));
      setBoats(DEFAULT_BOATS);
      setTerms(DEFAULT_TERMS);
    }
  }, []);

  function save() {
    try {
      setJsonItem("sb_boats", boats);
      setTextItem("sb_terms", terms);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      alert(getErrorMessage(error));
    }
  }

  function addBoat() {
    if (!newName.trim()) return;
    setBoats(prev => [...prev, { id: Date.now().toString(), name: newName.trim(), registration: newReg.trim() }]);
    setNewName(""); setNewReg("");
  }

  function removeBoat(id: string) {
    setBoats(prev => prev.filter(b => b.id !== id));
  }

  function updateBoat(id: string, field: "name" | "registration", value: string) {
    setBoats(prev => prev.map(b => b.id === id ? { ...b, [field]: value } : b));
  }

  return (
    <div className="py-6 min-h-screen">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.push("/")} className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center transition">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">Configuration</h1>
          <p className="text-sm text-gray-500">Fleet &amp; rental terms</p>
        </div>
        <button onClick={save} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors" style={{ backgroundColor: saved ? "#16a34a" : "#1B2A4A" }}>
          {saved ? "Saved ✓" : "Save"}
        </button>
      </div>

      <div className="flex border-b border-gray-200 mb-6">
        {(["boats", "terms"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className="px-5 py-3 text-sm font-medium border-b-2 transition-colors capitalize"
            style={{ borderBottomColor: tab === t ? "#1B2A4A" : "transparent", color: tab === t ? "#1B2A4A" : "#6b7280" }}>
            {t === "boats" ? "Fleet" : "Rental Terms"}
          </button>
        ))}
      </div>

      {tab === "boats" && (
        <div className="space-y-3">
          {boats.map(boat => (
            <div key={boat.id} className="rounded-xl border border-gray-100 p-4">
              <div className="flex gap-3 items-center">
                <input className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-base focus:outline-none focus:border-brand" value={boat.name} onChange={e => updateBoat(boat.id, "name", e.target.value)} placeholder="Boat name" />
                <input className="w-28 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-500 focus:outline-none focus:border-brand" value={boat.registration} onChange={e => updateBoat(boat.id, "registration", e.target.value)} placeholder="Reg. no." />
                <button onClick={() => removeBoat(boat.id)} className="w-10 h-10 flex items-center justify-center rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
          ))}
          <div className="rounded-xl border-2 border-dashed border-gray-200 p-4">
            <div className="flex gap-3 items-center">
              <input className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-base focus:outline-none focus:border-brand" value={newName} onChange={e => setNewName(e.target.value)} placeholder="New boat name..." onKeyDown={e => e.key === "Enter" && addBoat()} />
              <input className="w-28 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:outline-none focus:border-brand" value={newReg} onChange={e => setNewReg(e.target.value)} placeholder="Reg. no." onKeyDown={e => e.key === "Enter" && addBoat()} />
              <button onClick={addBoat} disabled={!newName.trim()} className="w-10 h-10 flex items-center justify-center rounded-lg bg-brand text-white disabled:opacity-30 transition shrink-0">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-400">Edit names inline. Tap red X to remove. Press Save when done.</p>
        </div>
      )}

      {tab === "terms" && (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">This text is shown to guests at the signing step. Edit freely.</p>
          <textarea className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 focus:outline-none focus:border-brand focus:ring-2 transition font-mono leading-relaxed" style={{ height: "60vh" }} value={terms} onChange={e => setTerms(e.target.value)} />
          <p className="text-xs text-gray-400">{terms.length} characters</p>
        </div>
      )}
    </div>
  );
}
