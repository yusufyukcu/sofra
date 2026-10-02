import "server-only";
import { sql, type Changes, type Db } from "../db/client";
import {
  findAddress,
  findRestaurantRow,
  listAddresses as addressesOf,
} from "../db/queries";
import type { Address, AddressLabel, LatLng, User } from "../types";
import { createId, round2 } from "../utils";
import { DomainError } from "../errors";
import { chargeCard } from "./cards";
import { applyWallet } from "./wallet";

/**
 * Hesap servisi: adres defteri, favoriler ve cüzdana bakiye yükleme.
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

const LABELS: AddressLabel[] = ["ev", "is", "diger"];

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
  if (input.label !== undefined && !LABELS.includes(input.label)) {
    throw new DomainError("invalid_label", "Adres etiketi ev, iş ya da diğer olmalı.");
  }
  if (input.point) {
    const { lat, lng } = input.point;
    if (
      typeof lat !== "number" ||
      typeof lng !== "number" ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      Math.abs(lat) > 90 ||
      Math.abs(lng) > 180
    ) {
      throw new DomainError("invalid_point", "Harita üzerinde geçerli bir konum seçmelisin.");
    }
  }
}

const clean = (value: string | undefined, max = 200) => {
  const trimmed = value?.trim().slice(0, max);
  return trimmed ? trimmed : null;
};

export async function listAddresses(user: User): Promise<Address[]> {
  return addressesOf(user.id);
}

export async function createAddress(user: User, input: AddressInput): Promise<Address> {
  validateAddress(input);
  if (!input.title?.trim() || !input.line1?.trim()) {
    throw new DomainError("address_incomplete", "Adres başlığı ve açık adres gerekli.");
  }
  if (!input.point) {
    throw new DomainError("point_required", "Haritadan konum seçmen gerekiyor.");
  }

  const id = createId("adr");
  await sql.begin(async (tx) => {
    const [{ count }] = await tx<{ count: number }[]>`
      select count(*)::int as count from public.addresses where user_id = ${user.id}
    `;
    if (count >= 20) {
      throw new DomainError("too_many_addresses", "En fazla 20 adres kaydedebilirsin.");
    }
    const isDefault = input.isDefault ?? count === 0;
    if (isDefault) {
      await tx`update public.addresses set is_default = false where user_id = ${user.id}`;
    }
    await tx`
      insert into public.addresses (
        id, user_id, label, title, line1, district, city, directions, building_no,
        floor, apartment_no, contact_name, contact_phone, lat, lng, is_default
      ) values (
        ${id}, ${user.id}, ${input.label ?? "diger"}, ${input.title.trim().slice(0, 40)},
        ${input.line1.trim().slice(0, 160)}, ${clean(input.district, 60) ?? "—"},
        ${clean(input.city, 60) ?? "İstanbul"}, ${clean(input.directions)},
        ${clean(input.buildingNo, 10)}, ${clean(input.floor, 10)}, ${clean(input.apartmentNo, 10)},
        ${clean(input.contactName, 60) ?? user.name}, ${clean(input.contactPhone, 20) ?? user.phone ?? null},
        ${input.point.lat}, ${input.point.lng}, ${isDefault}
      )
    `;
    if (isDefault) {
      await tx`update public.profiles set default_address_id = ${id} where id = ${user.id}`;
    }
  });

  return (await findAddress(user.id, id))!;
}

export async function updateAddress(
  user: User,
  addressId: string,
  patch: Partial<AddressInput>
): Promise<Address> {
  validateAddress(patch);

  const changes: Changes = {};
  if (patch.label !== undefined) changes.label = patch.label;
  if (patch.title !== undefined) changes.title = patch.title.trim().slice(0, 40);
  if (patch.line1 !== undefined) changes.line1 = patch.line1.trim().slice(0, 160);
  if (patch.district !== undefined) changes.district = clean(patch.district, 60) ?? "—";
  if (patch.city !== undefined) changes.city = clean(patch.city, 60) ?? "İstanbul";
  if (patch.directions !== undefined) changes.directions = clean(patch.directions);
  if (patch.buildingNo !== undefined) changes.buildingNo = clean(patch.buildingNo, 10);
  if (patch.floor !== undefined) changes.floor = clean(patch.floor, 10);
  if (patch.apartmentNo !== undefined) changes.apartmentNo = clean(patch.apartmentNo, 10);
  if (patch.contactName !== undefined) changes.contactName = clean(patch.contactName, 60);
  if (patch.contactPhone !== undefined) changes.contactPhone = clean(patch.contactPhone, 20);
  if (patch.point) {
    changes.lat = patch.point.lat;
    changes.lng = patch.point.lng;
  }

  await sql.begin(async (tx) => {
    const existing = await findAddress(user.id, addressId, tx);
    if (!existing) throw new DomainError("address_not_found", "Adres bulunamadı.", 404);

    if (Object.keys(changes).length > 0) {
      await tx`
        update public.addresses set ${tx(changes, Object.keys(changes))}
         where id = ${addressId} and user_id = ${user.id}
      `;
    }
    if (patch.isDefault) await makeDefault(tx, user.id, addressId);
  });

  return (await findAddress(user.id, addressId))!;
}

async function makeDefault(tx: Db, userId: string, addressId: string) {
  await tx`update public.addresses set is_default = (id = ${addressId}) where user_id = ${userId}`;
  await tx`update public.profiles set default_address_id = ${addressId} where id = ${userId}`;
}

export async function deleteAddress(user: User, addressId: string): Promise<Address[]> {
  await sql.begin(async (tx) => {
    const [deleted] = await tx<{ isDefault: boolean }[]>`
      delete from public.addresses where id = ${addressId} and user_id = ${user.id}
      returning is_default
    `;
    if (!deleted) throw new DomainError("address_not_found", "Adres bulunamadı.", 404);

    if (deleted.isDefault) {
      const [next] = await tx<{ id: string }[]>`
        select id from public.addresses where user_id = ${user.id} order by created_at limit 1
      `;
      if (next) await makeDefault(tx, user.id, next.id);
      else await tx`update public.profiles set default_address_id = null where id = ${user.id}`;
    }
  });
  return addressesOf(user.id);
}

export async function setDefaultAddress(user: User, addressId: string): Promise<Address[]> {
  await sql.begin(async (tx) => {
    const existing = await findAddress(user.id, addressId, tx);
    if (!existing) throw new DomainError("address_not_found", "Adres bulunamadı.", 404);
    await makeDefault(tx, user.id, addressId);
  });
  return addressesOf(user.id);
}

/* ------------------------------------------------------------------ */
/* Favoriler                                                           */
/* ------------------------------------------------------------------ */

export async function toggleFavorite(user: User, restaurantId: string): Promise<string[]> {
  const restaurant = await findRestaurantRow(restaurantId);
  if (!restaurant || restaurant.approvalStatus !== "approved") {
    throw new DomainError("restaurant_not_found", "Restoran bulunamadı.", 404);
  }

  const removed = await sql`
    delete from public.favorites where user_id = ${user.id} and restaurant_id = ${restaurant.id}
    returning restaurant_id
  `;
  if (removed.length === 0) {
    await sql`
      insert into public.favorites (user_id, restaurant_id) values (${user.id}, ${restaurant.id})
      on conflict do nothing
    `;
  }

  const rows = await sql<{ restaurantId: string }[]>`
    select restaurant_id from public.favorites where user_id = ${user.id} order by created_at
  `;
  return rows.map((r) => r.restaurantId);
}

/* ------------------------------------------------------------------ */
/* Cüzdan                                                              */
/* ------------------------------------------------------------------ */

/**
 * Bakiye yükleme. Tutar kayıtlı karttan çekilir (ödeme geçidi şimdilik
 * simüle: test kartıyla başarılı, "reddedilir" test kartıyla başarısız);
 * ödeme kaydı tutulur ve geçit raporunda görünür.
 */
export async function topUpWallet(user: User, amount: number, cardId?: string): Promise<number> {
  const value = round2(Number(amount));
  if (!Number.isFinite(value) || value <= 0) {
    throw new DomainError("invalid_amount", "Geçerli bir tutar gir.");
  }
  if (value > 5000) {
    throw new DomainError("amount_too_large", "Tek seferde en fazla 5.000 ₺ yükleyebilirsin.");
  }

  return sql.begin(async (tx) => {
    const card = await chargeCard(user.id, cardId, tx);
    await tx`
      insert into public.payments (id, user_id, provider, method, purpose, amount, status, card_brand, card_last4)
      values (${createId("pmt")}, ${user.id}, 'simulated', 'online_card', 'wallet_topup', ${value}, 'captured',
              ${card.brand}, ${card.last4})
    `;
    return applyWallet(tx, user.id, value, "topup", `Bakiye yükleme · ${card.brand.toUpperCase()} •••• ${card.last4}`);
  });
}
