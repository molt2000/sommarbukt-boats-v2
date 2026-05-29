import { getJsonItem } from "./safe-storage";

export interface Rental {
  id: string;
  createdAt: string;
  status: "active" | "completed" | "cancelled";

  // Guest
  guestName: string;
  guestPhone: string;
  guestEmail: string;
  nationality: string;
  idNumber: string;
  idPhotoData: string; // base64
  idPhotoDataBack: string; // base64 - back of ID card
  passengerCount: number;
  hasLicence: boolean;
  licenceNumber: string;
  licencePhotoData: string; // base64
  bornBefore1980: boolean;

  // Rental
  boatId: string;
  boatName: string;
  checkoutDate: string;
  returnDate: string;
  actualReturn: string;

  // Safety
  safetyChecklist: Record<string, boolean>;

  // Damage documentation
  checkoutDamages: Damage[];
  checkinDamages: Damage[];

  // Condition
  checkoutFuel: string;

  // Return
  checkinFuel: string;

  // Payment
  rentalFee: string;
  depositAmount: string;
  depositReceived: boolean;
  depositReturned: boolean;
  depositDeduction: string;

  // Signature
  signatureData: string; // base64
}

export interface Damage {
  id: string;
  view: 'stb' | 'bb' | 'front' | 'rear' | 'top';
  px: number; // position % relative to container
  py: number;
  photos: string[]; // base64 or URL
  desc: string;
  date: number; // timestamp
}


export interface Boat {
  id: string;
  name: string;
  available?: boolean;
}

const DEFAULT_BOATS: Boat[] = [
  { id: "1", name: "Tind", available: true },
  { id: "2", name: "Nordlys", available: true },
];

export function getBoats(): Boat[] {
  const boats = getJsonItem<{ id: string; name: string }[]>("sb_boats", DEFAULT_BOATS);
  return boats;
}

export const RENTAL_TERMS = `BOAT RENTAL AGREEMENT
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

export const SAFETY_ITEMS = [
  "Life jackets (6 on board)",
  "Anchor and rope present",
  "Fire extinguisher",
  "First aid kit",
  "Weather advisory acknowledged",
  "Key handed over",
];

export const FUEL_LEVELS = ["Full", "3/4", "Half", "1/4", "Empty"];

export function newRental(): Rental {
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    status: "active",
    guestName: "", guestPhone: "", guestEmail: "", nationality: "", idNumber: "",
    idPhotoData: "", idPhotoDataBack: "", passengerCount: 1, hasLicence: false, licenceNumber: "", licencePhotoData: "",
    bornBefore1980: false,
    boatId: "", boatName: "",
    checkoutDate: new Date().toISOString().slice(0, 16), returnDate: "", actualReturn: "",
    safetyChecklist: Object.fromEntries(SAFETY_ITEMS.map(i => [i, false])),
    checkoutDamages: [], checkinDamages: [],
    checkoutFuel: "Full",
    checkinFuel: "",
    rentalFee: "", depositAmount: "", depositReceived: false,
    depositReturned: false, depositDeduction: "",
    signatureData: "",
  };
}
