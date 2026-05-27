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
  depositReceived: boolean;
  depositReturned: boolean;
  depositDeduction: string;

  // Signature
  signatureData: string; // base64
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

export function getTerms(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("sb_terms") || "";
}

export const SAFETY_ITEMS = [
  "Life jackets (6 on board)",
  "Anchor and rope present",
  "Fire extinguisher",
  "First aid kit",
  "Weather advisory acknowledged",
  "Key handed over",
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
    bornBefore1980: false,
    boatId: "", boatName: "",
    checkoutDate: new Date().toISOString().slice(0, 16), returnDate: "", actualReturn: "",
    safetyChecklist: Object.fromEntries(SAFETY_ITEMS.map(i => [i, false])),
    checkoutPhotos: [], checkoutFuel: "Full", checkoutCondition: "Good", checkoutDamageNotes: "",
    checkinPhotos: [], checkinFuel: "", checkinCondition: "", checkinDamageNotes: "", damageFound: false,
    rentalFee: "", depositAmount: "", depositReceived: false,
    depositReturned: false, depositDeduction: "",
    signatureData: "",
  };
}
