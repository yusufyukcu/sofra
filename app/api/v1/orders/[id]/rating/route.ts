import { handle, ok, readJson } from "@/lib/api/respond";
import { requireUser } from "@/lib/auth/session";
import { rateOrder, type RatingInput } from "@/lib/services/orders";

/**
 * POST /api/v1/orders/:id/rating
 * Body: { restaurantScore, restaurantComment?, courierScore?, courierComment? }
 *
 * Restoran ve kurye ayrı ayrı puanlanır. Yorum bırakılırsa restoran
 * sayfasındaki değerlendirmeler listesine eklenir.
 */
export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const user = await requireUser(request);
    const { id } = await ctx.params;
    const body = await readJson<RatingInput>(request);
    const { order, review } = rateOrder(user, id, body);
    return ok({ order, review });
  });
}
