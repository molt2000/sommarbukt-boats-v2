import { createClient } from "@/lib/supabase/client";
import { rowToBoat, rowToDamage, damageToRow, rowToRental, rentalToRow } from "@/lib/mappers";
import { deletePaths } from "@/lib/upload";
import type { Boat, Damage, Rental } from "./types";

export async function getBoats(): Promise<Boat[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from("boats").select("*").order("name");
  if (error) throw new Error(`Could not load boats: ${error.message}`);
  return (data ?? []).map(rowToBoat);
}

/** Active (non-repaired) damages for a boat, used to show history on new rentals. */
export async function getBoatDamages(boatId: string): Promise<Damage[]> {
  if (!boatId) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("damages")
    .select("*")
    .eq("boat_id", boatId)
    .is("repaired_at", null)
    .order("created_at");
  if (error) throw new Error(`Could not load boat damages: ${error.message}`);
  return (data ?? []).map(rowToDamage);
}

async function damagesForRental(rentalId: string): Promise<{ checkout: Damage[]; checkin: Damage[] }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("damages")
    .select("*")
    .eq("rental_id", rentalId)
    .order("created_at");
  if (error) throw new Error(`Could not load damages: ${error.message}`);
  const checkout: Damage[] = [];
  const checkin: Damage[] = [];
  for (const row of data ?? []) {
    (row.phase === "checkin" ? checkin : checkout).push(rowToDamage(row));
  }
  return { checkout, checkin };
}

export async function getRentals(): Promise<Rental[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from("rentals").select("*").order("created_at", { ascending: false });
  if (error) throw new Error(`Could not load rentals: ${error.message}`);
  const rentals: Rental[] = [];
  for (const row of data ?? []) {
    const { checkout, checkin } = await damagesForRental(row.id);
    rentals.push(rowToRental(row, checkout, checkin));
  }
  return rentals;
}

export async function getRental(id: string): Promise<Rental | undefined> {
  const supabase = createClient();
  const { data, error } = await supabase.from("rentals").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`Could not load rental: ${error.message}`);
  if (!data) return undefined;
  const { checkout, checkin } = await damagesForRental(data.id);
  return rowToRental(data, checkout, checkin);
}

/**
 * Saves a rental (upsert) and its damages. The DB partial unique index
 * `one_active_rental_per_boat` enforces one active rental per boat; a violation
 * surfaces as a friendly error.
 */
export async function saveRental(rental: Rental): Promise<void> {
  const supabase = createClient();

  const { error: rentalError } = await supabase.from("rentals").upsert(rentalToRow(rental));
  if (rentalError) {
    if (rentalError.code === "23505") {
      throw new Error("This boat is already out on the water. Please confirm the return first.");
    }
    throw new Error(`Could not save rental: ${rentalError.message}`);
  }

  const rows = [
    ...rental.checkoutDamages.map((d) => damageToRow(d, rental.id, rental.boatId, "checkout")),
    ...rental.checkinDamages.map((d) => damageToRow(d, rental.id, rental.boatId, "checkin")),
  ];
  if (rows.length) {
    const { error: dmgError } = await supabase.from("damages").upsert(rows);
    if (dmgError) throw new Error(`Could not save damages: ${dmgError.message}`);
  }
}

/** Soft-delete: hides a damage from new rentals but keeps it on its original rental. */
export async function markDamageRepaired(damageId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("damages")
    .update({ repaired_at: new Date().toISOString() })
    .eq("id", damageId);
  if (error) throw new Error(`Could not mark damage repaired: ${error.message}`);
}

export async function deleteRental(id: string): Promise<void> {
  const supabase = createClient();

  const rental = await getRental(id);
  if (rental) {
    const photoPaths = [
      rental.idPhotoPath,
      rental.idPhotoBackPath,
      rental.licencePhotoPath,
      rental.signaturePath,
      ...rental.checkoutDamages.flatMap((d) => d.photoPaths),
      ...rental.checkinDamages.flatMap((d) => d.photoPaths),
    ];
    await deletePaths(photoPaths);
  }

  // damages rows are removed via ON DELETE CASCADE
  const { error } = await supabase.from("rentals").delete().eq("id", id);
  if (error) throw new Error(`Could not delete rental: ${error.message}`);
}
