import { getJsonItem, setJsonItem } from "./safe-storage";
import { Rental } from "./types";

const KEY = "sommarbukt-rentals";

export function getRentals(): Rental[] {
  if (typeof window === "undefined") return [];

  const raw = localStorage.getItem(KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error("Stored rental data is not a list.");
    }
    return parsed;
  } catch (error) {
    console.error("Could not read rentals from localStorage:", error);
    throw new Error(
      "Stored rental data is damaged and could not be opened. Please export or inspect the browser data before continuing."
    );
  }
}

export function getRental(id: string): Rental | undefined {
  return getRentals().find(r => r.id === id);
}

/**
 * Enforces: only ONE active rental per boat.
 * If you try to save an ACTIVE rental for a boat that already has another ACTIVE rental,
 * this function throws an Error (caller must handle it).
 */
export function saveRental(rental: Rental) {
  if (typeof window === "undefined") return;

  const all = getRentals();

  const status = String((rental as any)?.status ?? "").toLowerCase();
  const boatId = (rental as any)?.boatId as string | undefined;

  if (status === "active" && boatId) {
    const conflict = all.find(r => {
      const rStatus = String((r as any)?.status ?? "").toLowerCase();
      const rBoatId = (r as any)?.boatId as string | undefined;
      return r.id !== rental.id && rStatus === "active" && rBoatId === boatId;
    });

    if (conflict) {
      throw new Error(
        `This boat is already out on the water (active rental: ${conflict.id}). Please confirm the return first.`
      );
    }
  }

  const idx = all.findIndex(r => r.id === rental.id);
  if (idx >= 0) all[idx] = rental;
  else all.unshift(rental);

  setJsonItem(KEY, all);
}

export function deleteRental(id: string) {
  if (typeof window === "undefined") return;
  const all = getRentals().filter(r => r.id !== id);
  setJsonItem(KEY, all);
}
