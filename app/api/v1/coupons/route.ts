import { handle, ok } from "@/lib/api/respond";
import { currentUser } from "@/lib/auth/session";
import { allCoupons, db, ordersOf } from "@/lib/db/store";

/**
 * GET /api/v1/coupons
 * Kullanıcıya gösterilebilecek (süresi dolmamış, daha önce kullanılmamış)
 * kampanya kodları. "Kuponlarım" ekranı ve checkout önerileri bunu kullanır.
 */
export async function GET(request: Request) {
  return handle(async () => {
    const user = await currentUser(request);
    const now = Date.now();
    const usedCodes = user
      ? new Set(
          db()
            .couponUsage.filter((u) => u.userId === user.id)
            .map((u) => u.code.toUpperCase())
        )
      : new Set<string>();
    const isFirstOrder = user ? ordersOf(user.id).length === 0 : true;

    const coupons = allCoupons()
      .filter((c) => c.active)
      .filter((c) => new Date(c.expiresAt).getTime() > now)
      .filter((c) => !usedCodes.has(c.code.toUpperCase()))
      .filter((c) => !c.firstOrderOnly || isFirstOrder);

    return ok({ coupons });
  });
}
