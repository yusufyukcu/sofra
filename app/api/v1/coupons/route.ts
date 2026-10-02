import { handle, ok } from "@/lib/api/respond";
import { currentUser } from "@/lib/auth/session";
import { availableCoupons } from "@/lib/services/coupons";

/**
 * GET /api/v1/coupons — kullanıcının şu an kullanabileceği kampanyalar.
 * Kullanılmış, süresi dolmuş ve (ilk sipariş verilmişse) ilk siparişe özel
 * kodlar listelenmez.
 */
export async function GET(request: Request) {
  return handle(async () => {
    const user = await currentUser(request);
    return ok({ coupons: await availableCoupons(user) });
  });
}
