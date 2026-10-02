import "server-only";
import { sql, type Db } from "../db/client";
import { DomainError } from "../errors";
import { round2 } from "../utils";

/**
 * Platform cüzdanı.
 *
 * Bakiye `profiles.wallet_balance` kolonunda durur ama tek başına
 * değişmez: her artış ve azalış aynı işlemde `wallet_transactions`
 * defterine yazılır. Hareket listesi bu defterden okunur; bakiye ile
 * hareketlerin toplamı her zaman tutar.
 */

export type WalletTxType =
  | "welcome"
  | "topup"
  | "order_payment"
  | "order_refund"
  | "tip"
  | "admin_credit"
  | "admin_debit"
  | "manual_refund";

export interface WalletTransaction {
  id: string;
  type: "spend" | "refund" | "topup" | "credit" | "debit" | "tip";
  kind: WalletTxType;
  /** Bakiyeye giriş mi çıkış mı */
  direction: "in" | "out";
  amount: number;
  balanceAfter: number;
  label: string;
  at: string;
  orderId?: string;
}

/**
 * Bakiyeyi `amount` kadar değiştirir (eksi = düşüm) ve deftere yazar.
 * Bakiye eksiye düşecekse hiçbir şey yazılmaz ve hata döner.
 * Çağıran taraf bunu kendi işleminin içinde çağırmalı.
 */
export async function applyWallet(
  db: Db,
  userId: string,
  amount: number,
  type: WalletTxType,
  label: string,
  orderId?: string
): Promise<number> {
  const value = round2(amount);
  if (value === 0) {
    const [row] = await db<{ walletBalance: number }[]>`
      select wallet_balance from public.profiles where id = ${userId}
    `;
    return row?.walletBalance ?? 0;
  }

  const [row] = await db<{ walletBalance: number }[]>`
    update public.profiles
       set wallet_balance = wallet_balance + ${value}
     where id = ${userId} and wallet_balance + ${value} >= 0
    returning wallet_balance
  `;
  if (!row) {
    throw new DomainError(
      "insufficient_wallet",
      value < 0 ? "Cüzdan bakiyen bu işlem için yeterli değil." : "Cüzdan bulunamadı."
    );
  }

  await db`
    insert into public.wallet_transactions (user_id, amount, balance_after, type, label, order_id)
    values (${userId}, ${value}, ${row.walletBalance}, ${type}, ${label}, ${orderId ?? null})
  `;
  return row.walletBalance;
}

const VIEW_TYPE: Record<WalletTxType, WalletTransaction["type"]> = {
  welcome: "credit",
  topup: "topup",
  order_payment: "spend",
  order_refund: "refund",
  tip: "tip",
  admin_credit: "credit",
  admin_debit: "debit",
  manual_refund: "refund",
};

export async function walletHistory(
  userId: string,
  db: Db = sql,
  limit = 100
): Promise<WalletTransaction[]> {
  const rows = await db<
    {
      id: number;
      amount: number;
      balanceAfter: number;
      type: WalletTxType;
      label: string;
      orderId: string | null;
      createdAt: Date;
    }[]
  >`
    select id, amount, balance_after, type, label, order_id, created_at
      from public.wallet_transactions
     where user_id = ${userId}
     order by created_at desc, id desc
     limit ${limit}
  `;
  return rows.map((r) => ({
    id: String(r.id),
    type: VIEW_TYPE[r.type],
    kind: r.type,
    direction: r.amount > 0 ? "in" : "out",
    amount: Math.abs(r.amount),
    balanceAfter: r.balanceAfter,
    label: r.label,
    at: r.createdAt.toISOString(),
    orderId: r.orderId ?? undefined,
  }));
}
