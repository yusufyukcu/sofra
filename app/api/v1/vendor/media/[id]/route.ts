import { handle, ok } from "@/lib/api/respond";
import { requireVendor } from "@/lib/auth/vendor-session";
import {
  vendorMediaRequests,
  withdrawMediaRequest,
} from "@/lib/services/media";

/** DELETE /api/v1/vendor/media/:id — onay bekleyen fotoğrafı geri çeker */
export async function DELETE(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const { restaurant } = await requireVendor(request);
    const { id } = await ctx.params;
    await withdrawMediaRequest(restaurant.id, id);
    return ok({ requests: await vendorMediaRequests(restaurant.id) });
  });
}
