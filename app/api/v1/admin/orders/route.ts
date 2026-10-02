import { handle, ok } from "@/lib/api/respond";
import { requireAdmin } from "@/lib/auth/admin-session";
import { searchOrders } from "@/lib/services/admin";

/**
 * GET /api/v1/admin/orders?q=
 * Sipariş arama (kod, müşteri adı, telefon). Boş sorguda son kapanan
 * siparişler döner — teslim edilmiş siparişe iade buradan yapılır.
 */
export async function GET(request: Request) {
  return handle(async () => {
    await requireAdmin(request);
    const q = new URL(request.url).searchParams.get("q") ?? "";
    return ok({ orders: await searchOrders(q) });
  });
}
