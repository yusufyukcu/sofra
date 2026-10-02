import { handle, ok } from "@/lib/api/respond";
import { requireUser } from "@/lib/auth/session";
import { setDefaultAddress } from "@/lib/services/account";

/** POST /api/v1/addresses/:id/default — varsayılan teslimat adresini değiştirir */
export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const user = await requireUser(request);
    const { id } = await ctx.params;
    return ok({ addresses: await setDefaultAddress(user, id) });
  });
}
