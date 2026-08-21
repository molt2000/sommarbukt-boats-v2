import { describe, it, expect } from "vitest";
import { rowToBoat, rowToDamage, damageToRow, rowToRental, rentalToRow } from "./mappers";
import type { Rental, Damage } from "./types";

describe("rowToBoat", () => {
  it("maps a boat row to a Boat", () => {
    expect(rowToBoat({ id: "b1", name: "Tind", registration: "AB-1", available: true }))
      .toEqual({ id: "b1", name: "Tind", registration: "AB-1", available: true });
  });
  it("defaults missing registration/available", () => {
    expect(rowToBoat({ id: "b1", name: "Tind", registration: null, available: null }))
      .toEqual({ id: "b1", name: "Tind", registration: "", available: true });
  });
});

describe("damage <-> row", () => {
  const damage: Damage = {
    id: "d1", view: "stb", px: 10.5, py: 20.25,
    photoPaths: ["damage-photos/r1/d1-0.jpg"], desc: "scratch",
    date: 1700000000000, repairedAt: null,
  };
  it("damageToRow flattens for the damages table", () => {
    expect(damageToRow(damage, "r1", "b1", "checkout")).toEqual({
      id: "d1", rental_id: "r1", boat_id: "b1", phase: "checkout",
      view: "stb", px: 10.5, py: 20.25,
      photo_paths: ["damage-photos/r1/d1-0.jpg"], description: "scratch",
      repaired_at: null, created_at: new Date(1700000000000).toISOString(),
    });
  });
  it("rowToDamage round-trips", () => {
    const row = damageToRow(damage, "r1", "b1", "checkout");
    expect(rowToDamage(row)).toEqual(damage);
  });
  it("rowToDamage defaults null photo_paths to empty array", () => {
    const row = { ...damageToRow(damage, "r1", "b1", "checkout"), photo_paths: null };
    expect(rowToDamage(row).photoPaths).toEqual([]);
  });
});

describe("rental <-> row", () => {
  const rental: Rental = {
    id: "r1", createdAt: "2026-06-04T10:00:00.000Z", status: "active",
    guestName: "Jane", guestPhone: "+49", guestEmail: "j@e.com",
    nationality: "DE", idNumber: "X1", idPhotoPath: "id-photos/r1/front.jpg",
    idPhotoBackPath: "", passengerCount: 2, hasLicence: true, licenceNumber: "L1",
    licencePhotoPath: "", bornBefore1980: false,
    boatId: "b1", boatName: "Tind",
    checkoutDate: "2026-06-04T11:00:00.000Z", returnDate: "2026-06-05T11:00:00.000Z",
    actualReturn: "", safetyChecklist: { "Key handed over": true },
    checkoutDamages: [], checkinDamages: [],
    checkoutFuel: "Full", checkinFuel: "",
    rentalFee: "3100 NOK", depositAmount: "5000 NOK", depositReceived: true,
    depositReturned: false, depositDeduction: "", signaturePath: "signatures/r1.png",
    returnSignaturePath: "signatures/r1-return.png",
  };
  it("rentalToRow groups guest/payment and excludes damages", () => {
    const row = rentalToRow(rental);
    expect(row.id).toBe("r1");
    expect(row.status).toBe("active");
    expect(row.boat_id).toBe("b1");
    expect(row.guest).toEqual({
      guestName: "Jane", guestPhone: "+49", guestEmail: "j@e.com",
      nationality: "DE", idNumber: "X1", passengerCount: 2,
      hasLicence: true, licenceNumber: "L1", bornBefore1980: false,
    });
    expect(row.payment).toEqual({
      rentalFee: "3100 NOK", depositAmount: "5000 NOK", depositReceived: true,
      depositReturned: false, depositDeduction: "",
    });
    expect(row.signature_path).toBe("signatures/r1.png");
    expect(row.return_signature_path).toBe("signatures/r1-return.png");
    expect("checkoutDamages" in row).toBe(false);
  });
  it("rowToRental defaults a missing return signature to empty (pre-existing rows)", () => {
    const row = { ...rentalToRow(rental), return_signature_path: null };
    expect(rowToRental(row, [], []).returnSignaturePath).toBe("");
  });
  it("rowToRental rebuilds the flat Rental (damages injected separately)", () => {
    const row = rentalToRow(rental);
    const rebuilt = rowToRental(row, [], []);
    expect(rebuilt).toEqual(rental);
  });
  it("rowToRental injects checkout/checkin damages", () => {
    const row = rentalToRow(rental);
    const d: Damage = { id: "d1", view: "bb", px: 1, py: 2, photoPaths: [], desc: "", date: 1, repairedAt: null };
    const rebuilt = rowToRental(row, [d], []);
    expect(rebuilt.checkoutDamages).toEqual([d]);
    expect(rebuilt.checkinDamages).toEqual([]);
  });
});
