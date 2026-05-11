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
  idPhotoDataBack: string; // base64 — back of ID card
  passengerCount: number;
  hasLicence: boolean;
  licenceNumber: string;
  licencePhotoData: string; // base64

  // Rental
  boatId: string;
  boatName: string;
  rentalType: "half-day" | "full-day" | "multi-day";
  checkoutTime: string;
  expectedReturn: string;
  actualReturn: string;

  // Safety
  safetyChecklist: Record<string, boolean>;

  // Condition
  checkoutPhotos: PhotoEntry[];
  checkoutFuel: string;
  checkoutCondition: string;
  checkoutDamageNotes: string;

  // Return
  checkinPhotos: PhotoEntry[];
  checkinFuel: string;
  checkinCondition: string;
  checkinDamageNotes: string;
  damageFound: boolean;

  // Payment
  rentalFee: string;
  depositAmount: string;
  paymentReceived: boolean;
  depositReceived: boolean;
  paymentMethod: string;
  depositReturned: boolean;
  depositDeduction: string;

  // Signature
  signatureData: string; // base64
  termsAccepted: boolean;
  safetyBriefingDone: boolean;
}

export interface PhotoEntry {
  label: string;
  dataUrl: string;
  timestamp: string;
  gpsLat?: number;
  gpsLng?: number;
}

export interface Boat {
  id: string;
  name: string;
  available: boolean;
}

export function getBoats(): Boat[] {
  if (typeof window === "undefined") return [
    { id: "1", name: "Kaasboll 660 #1", available: true },
    { id: "2", name: "Kaasboll 660 #2", available: true },
  ];
  const raw = localStorage.getItem("sb_boats");
  if (!raw) return [
    { id: "1", name: "Kaasboll 660 #1", available: true },
    { id: "2", name: "Kaasboll 660 #2", available: true },
  ];
  return JSON.parse(raw).map((b: {id:string;name:string}) => ({ ...b, available: true }));
}

export function getTerms(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("sb_terms") || "";
}

export const SAFETY_ITEMS = [
  "Life jackets (correct count)",
  "Navigation lights working",
  "Horn / whistle present",
  "Anchor and rope present",
  "Emergency kit on board",
  "Fire extinguisher",
  "First aid kit",
  "Weather advisory acknowledged",
];

export const PHOTO_ANGLES = [
  "Bow (front)",
  "Stern (back)",
  "Port side (left)",
  "Starboard side (right)",
  "Cockpit / interior",
  "Engine",
];

export const FUEL_LEVELS = ["Full", "3/4", "Half", "1/4", "Empty"];

export function newRental(): Rental {
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    status: "active",
    guestName: "", guestPhone: "", guestEmail: "", nationality: "", idNumber: "",
    idPhotoData: "", idPhotoDataBack: "", passengerCount: 1, hasLicence: false, licenceNumber: "", licencePhotoData: "",
    boatId: "", boatName: "", rentalType: "full-day",
    checkoutTime: new Date().toISOString().slice(0, 16), expectedReturn: "", actualReturn: "",
    safetyChecklist: Object.fromEntries(SAFETY_ITEMS.map(i => [i, false])),
    checkoutPhotos: [], checkoutFuel: "Full", checkoutCondition: "Good", checkoutDamageNotes: "",
    checkinPhotos: [], checkinFuel: "", checkinCondition: "", checkinDamageNotes: "", damageFound: false,
    rentalFee: "", depositAmount: "", paymentReceived: false, depositReceived: false, paymentMethod: "Cash",
    depositReturned: false, depositDeduction: "",
    signatureData: "", termsAccepted: false, safetyBriefingDone: false,
  };
}
