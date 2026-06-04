import type { Boat, Damage, Rental } from "./types";

type Phase = "checkout" | "checkin";

export function rowToBoat(row: any): Boat {
  return {
    id: row.id,
    name: row.name,
    registration: row.registration ?? "",
    available: row.available ?? true,
  };
}

export function damageToRow(d: Damage, rentalId: string, boatId: string, phase: Phase) {
  return {
    id: d.id,
    rental_id: rentalId,
    boat_id: boatId,
    phase,
    view: d.view,
    px: d.px,
    py: d.py,
    photo_paths: d.photoPaths,
    description: d.desc,
    repaired_at: d.repairedAt,
    created_at: new Date(d.date).toISOString(),
  };
}

export function rowToDamage(row: any): Damage {
  return {
    id: row.id,
    view: row.view,
    px: row.px,
    py: row.py,
    photoPaths: row.photo_paths ?? [],
    desc: row.description ?? "",
    date: new Date(row.created_at).getTime(),
    repairedAt: row.repaired_at ?? null,
  };
}

export function rentalToRow(r: Rental) {
  return {
    id: r.id,
    created_at: r.createdAt,
    status: r.status,
    guest: {
      guestName: r.guestName,
      guestPhone: r.guestPhone,
      guestEmail: r.guestEmail,
      nationality: r.nationality,
      idNumber: r.idNumber,
      passengerCount: r.passengerCount,
      hasLicence: r.hasLicence,
      licenceNumber: r.licenceNumber,
      bornBefore1980: r.bornBefore1980,
    },
    id_photo_path: r.idPhotoPath || null,
    id_photo_back_path: r.idPhotoBackPath || null,
    licence_photo_path: r.licencePhotoPath || null,
    signature_path: r.signaturePath || null,
    boat_id: r.boatId || null,
    boat_name: r.boatName,
    checkout_date: r.checkoutDate || null,
    return_date: r.returnDate || null,
    actual_return: r.actualReturn || null,
    safety_checklist: r.safetyChecklist,
    checkout_fuel: r.checkoutFuel,
    checkin_fuel: r.checkinFuel,
    payment: {
      rentalFee: r.rentalFee,
      depositAmount: r.depositAmount,
      depositReceived: r.depositReceived,
      depositReturned: r.depositReturned,
      depositDeduction: r.depositDeduction,
    },
  };
}

export function rowToRental(row: any, checkoutDamages: Damage[], checkinDamages: Damage[]): Rental {
  const g = row.guest ?? {};
  const p = row.payment ?? {};
  return {
    id: row.id,
    createdAt: row.created_at,
    status: row.status,
    guestName: g.guestName ?? "",
    guestPhone: g.guestPhone ?? "",
    guestEmail: g.guestEmail ?? "",
    nationality: g.nationality ?? "",
    idNumber: g.idNumber ?? "",
    idPhotoPath: row.id_photo_path ?? "",
    idPhotoBackPath: row.id_photo_back_path ?? "",
    passengerCount: g.passengerCount ?? 1,
    hasLicence: g.hasLicence ?? false,
    licenceNumber: g.licenceNumber ?? "",
    licencePhotoPath: row.licence_photo_path ?? "",
    bornBefore1980: g.bornBefore1980 ?? false,
    boatId: row.boat_id ?? "",
    boatName: row.boat_name ?? "",
    checkoutDate: row.checkout_date ?? "",
    returnDate: row.return_date ?? "",
    actualReturn: row.actual_return ?? "",
    safetyChecklist: row.safety_checklist ?? {},
    checkoutDamages,
    checkinDamages,
    checkoutFuel: row.checkout_fuel ?? "Full",
    checkinFuel: row.checkin_fuel ?? "",
    rentalFee: p.rentalFee ?? "",
    depositAmount: p.depositAmount ?? "",
    depositReceived: p.depositReceived ?? false,
    depositReturned: p.depositReturned ?? false,
    depositDeduction: p.depositDeduction ?? "",
    signaturePath: row.signature_path ?? "",
  };
}
