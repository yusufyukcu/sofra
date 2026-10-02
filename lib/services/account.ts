import { addressesOf, commit, db, findAddress, findRestaurant } from "../db/store";
import type { Address, AddressLabel, LatLng, User } from "../types";
import { createId, round2 } from "../utils";
import { DomainError } from "../errors";

/**
 * Hesap servisi: adres defteri, favoriler ve platform cüzdanı.
 */

/* ------------------------------------------------------------------ */
/* Adresler                                                            */
/* ------------------------------------------------------------------ */

export interface AddressInput {
  label: AddressLabel;
  title: string;
  line1: string;
  district: string;
  city: string;
  point: LatLng;
  directions?: string;
  buildingNo?: string;
  floor?: string;
  apartmentNo?: string;
  contactName?: string;
  contactPhone?: string;
  isDefault?: boolean;
}

function validateAddress(input: Partial<AddressInput>) {
  if (input.title !== undefined && input.title.trim().length < 2) {
    throw new DomainError("invalid_title", "Adres başlığı en az 2 karakter olmalı.");
  }
  if (input.line1 !== undefined && input.line1.trim().length < 5) {
    throw new DomainError(
      "invalid_line1",
      "Açık adres en az 5 karakter olmalı (mahalle, cadde, no)."
    );
  }
  if (input.point) {
    const { lat, lng } = input.point;
    if (
      typeof lat !== "number" ||
      typeof lng !== "number" ||
      Math.abs(lat) > 90 ||
      Math.abs(lng) > 180
    ) {
      throw new DomainError(
        "invalid_point",
        "Harita üzerinde geçerli bir konum seçmelisin."
      );
    }
  }
}

export function listAddresses(user: User): Address[] {
  return addressesOf(user.id);
}

export function createAddress(user: User, input: AddressInput): Address {
  validateAddress(input);
  if (!input.point) {
    throw new DomainError(
      "point_required",
      "Haritadan konum seçmen gerekiyor."
    );
  }

  const existing = addressesOf(user.id);
  const address: Address = {
    id: createId("adr"),
    userId: user.id,
    label: input.label ?? "diger",
    title: input.title.trim(),
    line1: input.line1.trim(),
    district: input.district?.trim() || "—",
    city: input.city?.trim() || "İstanbul",
    directions: input.directions?.trim() || undefined,
    buildingNo: input.buildingNo?.trim() || undefined,
    floor: input.floor?.trim() || undefined,
    apartmentNo: input.apartmentNo?.trim() || undefined,
    contactName: input.contactName?.trim() || user.name,
    contactPhone: input.contactPhone?.trim() || user.phone,
    point: input.point,
    isDefault: input.isDefault ?? existing.length === 0,
    createdAt: new Date().toISOString(),
  };

  if (address.isDefault) {
    existing.forEach((a) => (a.isDefault = false));
    user.defaultAddressId = address.id;
  }

  db().addresses.push(address);
  commit();
  return address;
}

export function updateAddress(
  user: User,
  addressId: string,
  patch: Partial<AddressInput>
): Address {
  const address = findAddress(user.id, addressId);
  if (!address) {
    throw new DomainError("address_not_found", "Adres bulunamadı.", 404);
  }
  validateAddress(patch);

  const assign = <K extends keyof Address>(key: K, value: Address[K] | undefined) => {
    if (value !== undefined) address[key] = value;
  };

  assign("label", patch.label);
  assign("title", patch.title?.trim());
  assign("line1", patch.line1?.trim());
  assign("district", patch.district?.trim());
  assign("city", patch.city?.trim());
  assign("directions", patch.directions?.trim());
  assign("buildingNo", patch.buildingNo?.trim());
  assign("floor", patch.floor?.trim());
  assign("apartmentNo", patch.apartmentNo?.trim());
  assign("contactName", patch.contactName?.trim());
  assign("contactPhone", patch.contactPhone?.trim());
  assign("point", patch.point);

  if (patch.isDefault) setDefaultAddress(user, addressId);

  commit();
  return address;
}

export function deleteAddress(user: User, addressId: string): Address[] {
  const store = db();
  const address = findAddress(user.id, addressId);
  if (!address) {
    throw new DomainError("address_not_found", "Adres bulunamadı.", 404);
  }

  store.addresses = store.addresses.filter((a) => a.id !== addressId);

  const remaining = addressesOf(user.id);
  if (address.isDefault && remaining.length) {
    remaining[0].isDefault = true;
    user.defaultAddressId = remaining[0].id;
  } else if (!remaining.length) {
    user.defaultAddressId = undefined;
  }

  commit();
  return addressesOf(user.id);
}

export function setDefaultAddress(user: User, addressId: string): Address[] {
  const address = findAddress(user.id, addressId);
  if (!address) {
    throw new DomainError("address_not_found", "Adres bulunamadı.", 404);
  }
  addressesOf(user.id).forEach((a) => (a.isDefault = a.id === addressId));
  user.defaultAddressId = addressId;
  commit();
  return addressesOf(user.id);
}

/* ------------------------------------------------------------------ */
/* Favoriler                                                           */
/* ------------------------------------------------------------------ */

export function toggleFavorite(user: User, restaurantId: string): string[] {
  if (!findRestaurant(restaurantId)) {
    throw new DomainError("restaurant_not_found", "Restoran bulunamadı.", 404);
  }
  const set = new Set(user.favoriteRestaurantIds);
  if (set.has(restaurantId)) set.delete(restaurantId);
  else set.add(restaurantId);
  user.favoriteRestaurantIds = [...set];
  commit();
  return user.favoriteRestaurantIds;
}

/* ------------------------------------------------------------------ */
/* Cüzdan                                                              */
/* ------------------------------------------------------------------ */

export function topUpWallet(user: User, amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new DomainError("invalid_amount", "Geçerli bir tutar gir.");
  }
  if (amount > 5000) {
    throw new DomainError(
      "amount_too_large",
      "Tek seferde en fazla 5.000 ₺ yükleyebilirsin."
    );
  }
  user.walletBalance = round2(user.walletBalance + amount);
  commit();
  return user.walletBalance;
}
