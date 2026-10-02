import { handle, ok, readJson } from "@/lib/api/respond";
import { requireUser } from "@/lib/auth/session";
import { rateOrder, type RatingInput } from "@/lib/services/orders";

/**
 * POST /api/v1/orders/:id/rating
 * Restoran ve kurye ayrı puanlanır; kuryeye bahşiş cüzdandan düşer.
 */
export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const user = await requireUser(request);
    const { id } = await ctx.params;
    const body = await readJson<RatingInput>(request);
    return ok(await rateOrder(user, id, body));
  });
}
