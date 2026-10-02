import "server-only";
import { sql, type Db } from "../db/client";
import { toPayout, type PayoutRow } from "../db/mappers";
import type { Payout } from "../types";

/**
 * Hakediş defteri.
 *
 * Tutarlar veritabanında, işlemle aynı anda tahakkuk eder: teslim edilen
 * sipariş restoranın, kurye kazancı ve bahşiş kuryenin o haftaki açık
 * hakedişine eklenir (`app_private.accrue_payout`). Onaylanmış bir dönemin
 * tutarı donar; o haftaya sonradan gelen kayıt "ek" hakedişe yazılır.
 *
 * Restoran paneli, kurye uygulaması ve yönetici paneli aynı satırları okur.
 */

export async function listPayouts(
  filter: { kind?: Payout["kind"]; targetId?: string } = {},
  db: Db = sql
): Promise<Payout[]> {
  const kind = filter.kind ?? null;
  const target = filter.targetId ?? null;
  const rows = await db<PayoutRow[]>`
    select id, kind, target_id, target_name, period_key::text as period_key, period_label,
           orders, gross, commission, tips, net, status, approved_at, paid_at
      from public.payouts
     where (${kind}::text is null or kind = ${kind}::text)
       and (${target}::text is null or target_id = ${target}::text)
     order by period_key desc, created_at desc, target_name
  `;
  return rows.map(toPayout);
}

/** Bir tarafa ait hakedişler (restoran paneli ve kurye uygulaması okur). */
export async function payoutsFor(kind: Payout["kind"], targetId: string): Promise<Payout[]> {
  return listPayouts({ kind, targetId });
}
