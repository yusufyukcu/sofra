import { commit, db, findCourier, findRestaurant } from "../db/store";
import type { Payout } from "../types";
import { createId, round2 } from "../utils";

/**
 * Hakediş defteri.
 *
 * Restoran paneli, kurye uygulaması ve yönetici paneli aynı kayıtları okur:
 * üçünün gördüğü tutar ve durum her zaman aynıdır. Ayrı bir modülde
 * duruyor ki servisler arasında döngüsel bağımlılık oluşmasın.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Haftanın pazartesi anahtarı (YYYY-MM-DD). */
export function weekKey(date: Date): string {
  const monday = new Date(date);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().slice(0, 10);
}

export function weekLabel(key: string): string {
  const start = new Date(key);
  const end = new Date(start.getTime() + 6 * DAY_MS);
  const fmt = new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
  });
  return `${fmt.format(start)} – ${fmt.format(end)}`;
}

function upsertPayout(data: Omit<Payout, "id" | "periodLabel" | "status">) {
  const store = db();
  const existing = store.payouts.find(
    (p) =>
      p.kind === data.kind &&
      p.targetId === data.targetId &&
      p.periodKey === data.periodKey
  );

  if (existing) {
    // Onaylanmış hakedişin tutarı dondurulur — sonradan değişmez.
    if (existing.status === "pending") Object.assign(existing, data);
    return;
  }

  store.payouts.push({
    id: createId("pay"),
    periodLabel: weekLabel(data.periodKey),
    status: "pending",
    ...data,
  });
}

/**
 * Teslim edilmiş siparişlerden ve kurye kazançlarından haftalık hakediş
 * kayıtlarını üretir/günceller. Simülatörle aynı mantıkla okuma anında
 * çalışır; zamanlayıcı gerektirmez.
 */
export function syncPayouts(): Payout[] {
  const store = db();
  const delivered = store.orders.filter((o) => o.status === "delivered");

  /* Restoran hakedişleri: brüt ciro − platform komisyonu */
  const vendorMap = new Map<string, { orders: number; gross: number }>();
  for (const order of delivered) {
    const key = `${order.restaurantId}|${weekKey(new Date(order.createdAt))}`;
    const entry = vendorMap.get(key) ?? { orders: 0, gross: 0 };
    entry.orders += 1;
    entry.gross = round2(entry.gross + order.totals.subtotal);
    vendorMap.set(key, entry);
  }

  for (const [key, entry] of vendorMap) {
    const [restaurantId, periodKey] = key.split("|");
    const restaurant = findRestaurant(restaurantId);
    if (!restaurant) continue;

    const commission = round2(entry.gross * restaurant.commissionRate);
    upsertPayout({
      kind: "vendor",
      targetId: restaurantId,
      targetName: restaurant.name,
      periodKey,
      orders: entry.orders,
      gross: entry.gross,
      commission,
      tips: 0,
      net: round2(entry.gross - commission),
    });
  }

  /* Kurye hakedişleri: paket ücretleri + bahşiş */
  const courierMap = new Map<
    string,
    { orders: number; fee: number; tips: number }
  >();
  for (const earning of store.earnings) {
    const key = `${earning.courierId}|${weekKey(new Date(earning.at))}`;
    const entry = courierMap.get(key) ?? { orders: 0, fee: 0, tips: 0 };
    entry.orders += 1;
    entry.fee = round2(entry.fee + earning.fee);
    entry.tips = round2(entry.tips + earning.tip);
    courierMap.set(key, entry);
  }

  for (const [key, entry] of courierMap) {
    const [courierId, periodKey] = key.split("|");
    const courier = findCourier(courierId);
    if (!courier) continue;

    upsertPayout({
      kind: "courier",
      targetId: courierId,
      targetName: courier.name,
      periodKey,
      orders: entry.orders,
      gross: entry.fee,
      commission: 0,
      tips: entry.tips,
      net: round2(entry.fee + entry.tips),
    });
  }

  commit();

  return [...store.payouts].sort((a, b) =>
    a.periodKey === b.periodKey
      ? a.targetName.localeCompare(b.targetName, "tr")
      : a.periodKey < b.periodKey
        ? 1
        : -1
  );
}

/** Bir tarafa ait hakedişler (restoran paneli ve kurye uygulaması okur). */
export function payoutsFor(
  kind: Payout["kind"],
  targetId: string
): Payout[] {
  return syncPayouts().filter(
    (p) => p.kind === kind && p.targetId === targetId
  );
}
