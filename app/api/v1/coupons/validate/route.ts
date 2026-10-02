import { handle, ok, readJson } from "@/lib/api/respond";
import { requireUser } from "@/lib/auth/session";
import { quoteOrder, type QuoteInput } from "@/lib/services/coupons";

/**
 * POST /api/v1/coupons/validate
 * Body: { restaurantId, lines, code?, paymentMethod? }
 *
 * Sepeti menüden yeniden doğrular ve tutarları (indirim, teslimat, hizmet
 * bedeli) sunucuda hesaplar. Ödeme ekranı her değişiklikte buraya sorar.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser(request);
    const body = await readJson<QuoteInput>(request);
    return ok(await quoteOrder(user, body));
  });
}
