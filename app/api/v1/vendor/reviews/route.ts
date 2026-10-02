import { handle, ok, readJson } from "@/lib/api/respond";
import { requireVendor } from "@/lib/auth/vendor-session";
import { replyToReview, vendorReviews } from "@/lib/services/vendor";

/** GET /api/v1/vendor/reviews — musteri degerlendirmeleri */
export async function GET(request: Request) {
  return handle(async () => {
    const { restaurant } = await requireVendor(request);
    const reviews = await vendorReviews(restaurant.id);

    return ok({
      reviews,
      rating: restaurant.rating,
      ratingCount: restaurant.ratingCount,
      unanswered: reviews.filter((r) => !r.reply && r.comment).length,
    });
  });
}

/** POST /api/v1/vendor/reviews — yoruma cevap yaz */
export async function POST(request: Request) {
  return handle(async () => {
    const { restaurant } = await requireVendor(request);
    const body = await readJson<{ reviewId?: string; reply?: string }>(request);
    const review = await replyToReview(
      restaurant.id,
      body.reviewId ?? "",
      body.reply ?? ""
    );
    return ok({ review });
  });
}
