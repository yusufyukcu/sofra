import { handle, ok, readJson } from "@/lib/api/respond";
import { requireUser } from "@/lib/auth/session";
import { topUpWallet } from "@/lib/services/account";
import { walletHistory } from "@/lib/services/wallet";

/**
 * GET /api/v1/wallet — bakiye ve hareketler.
 *
 * Hareketler cüzdan defterinden okunur: yükleme, sipariş ödemesi, iade,
 * bahşiş ve platform düzeltmeleri. Bakiye ile hareketlerin toplamı tutar.
 */
export async function GET(request: Request) {
  return handle(async () => {
    const user = await requireUser(request);
    return ok({ balance: user.walletBalance, transactions: await walletHistory(user.id) });
  });
}

/** POST /api/v1/wallet — bakiye yükleme (ödeme geçidi şimdilik simüle) */
export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser(request);
    const body = await readJson<{ amount?: number }>(request);
    const balance = await topUpWallet(user, Number(body.amount));
    return ok({ balance, transactions: await walletHistory(user.id) });
  });
}
