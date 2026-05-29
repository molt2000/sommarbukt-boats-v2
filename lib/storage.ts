import { getJsonItem, setJsonItem } from "./safe-storage";
import { Damage, Rental } from "./types";

const BOAT_DAMAGES_KEY = "sb_boat_damages";

export function getBoatDamages(boatId: string): Damage[] {
  const all = getJsonItem<Record<string, Damage[]>>(BOAT_DAMAGES_KEY, {});
  return all[boatId] ?? [];
}

function mergeBoatDamages(boatId: string, damages: Damage[]): void {
  if (!boatId || !damages.length) return;
  const all = getJsonItem<Record<string, Damage[]>>(BOAT_DAMAGES_KEY, {});
  const existing = all[boatId] ?? [];
  const existingIds = new Set(existing.map((d) => d.id));
  const toAdd = damages.filter((d) => !existingIds.has(d.id));
  if (toAdd.length) {
    all[boatId] = [...existing, ...toAdd];
    setJsonItem(BOAT_DAMAGES_KEY, all);
  }
}

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

  if (rental.status === "active" && rental.boatId) {
    const conflict = all.find(r =>
      r.id !== rental.id && r.status === "active" && r.boatId === rental.boatId
    );

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

  // Persist all documented damages to the per-boat store
  mergeBoatDamages(rental.boatId, [
    ...(rental.checkoutDamages ?? []),
    ...(rental.checkinDamages ?? []),
  ]);
}

export function deleteRental(id: string) {
  if (typeof window === "undefined") return;
  const all = getRentals().filter(r => r.id !== id);
  setJsonItem(KEY, all);
}
