import { handle, ok, readJson } from "@/lib/api/respond";
import { requireUser } from "@/lib/auth/session";
import { createOrder, listOrders, type CreateOrderInput } from "@/lib/services/orders";

/** GET /api/v1/orders — sipariş geçmişi */
export async function GET(request: Request) {
  return handle(async () => {
    const user = await requireUser(request);
    return ok({ orders: await listOrders(user) });
  });
}

/**
 * POST /api/v1/orders — sipariş oluşturma.
 *
 * Sunucu; menüyü, fiyatları, minimum sepet tutarını, teslimat bölgesini,
 * kuponu ve ödeme yöntemini yeniden doğrular. İstemciden gelen fiyat
 * bilgisine güvenilmez.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser(request);
    const body = await readJson<CreateOrderInput>(request);
    const { order, walletBalance } = await createOrder(user, body);
    return ok({ order, walletBalance }, { status: 201 });
  });
}
