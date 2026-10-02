import { handle, ok, readJson } from "@/lib/api/respond";
import { requireUser } from "@/lib/auth/session";
import { PAYMENT_METHODS } from "@/lib/constants";
import { topUpWallet } from "@/lib/services/account";
import { listOrders } from "@/lib/services/orders";

/**
 * GET /api/v1/wallet — bakiye ve hareketler.
 *
 * Hareketler sipariş geçmişinden türetilir: online ödemeler harcama,
 * iptal edilen online siparişler iade olarak görünür. Gerçek sistemde
 * ayrı bir `wallet_transactions` tablosu tutulur.
 */
export async function GET(request: Request) {
  return handle(async () => {
    const user = await requireUser(request);
    const orders = listOrders(user);

    const transactions = orders.flatMap((order) => {
      const entries: {
        id: string;
        type: "spend" | "refund";
        amount: number;
        label: string;
        at: string;
        orderId: string;
      }[] = [];

      if (order.paymentMethod === "wallet" && order.status !== "cancelled") {
        entries.push({
          id: `${order.id}_spend`,
          type: "spend",
          amount: order.totals.grandTotal,
          label: `${order.restaurantName} siparişi`,
          at: order.createdAt,
          orderId: order.id,
        });
      }
      if (
        order.status === "cancelled" &&
        !PAYMENT_METHODS[order.paymentMethod].onDelivery
      ) {
        entries.push({
          id: `${order.id}_refund`,
          type: "refund",
          amount: order.totals.grandTotal,
          label: `${order.restaurantName} — iptal iadesi`,
          at: order.cancelledAt ?? order.createdAt,
          orderId: order.id,
        });
      }
      return entries;
    });

    transactions.sort(
      (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()
    );

    return ok({ balance: user.walletBalance, transactions });
  });
}

/** POST /api/v1/wallet — bakiye yükleme (prototipte ödeme geçidi simüle edilir) */
export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser(request);
    const body = await readJson<{ amount?: number }>(request);
    const balance = topUpWallet(user, Number(body.amount));
    return ok({ balance });
  });
}
