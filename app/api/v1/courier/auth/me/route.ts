import { fail, handle, ok } from "@/lib/api/respond";
import { currentCourier, publicCourier } from "@/lib/auth/courier-session";
import { courierStats } from "@/lib/services/courier";

/** GET /api/v1/courier/auth/me — uygulama acilisinda onyukleme */
export async function GET(request: Request) {
  return handle(async () => {
    const courier = await currentCourier(request);
    if (!courier) return fail("courier_unauthorized", "Giris yapilmamis.", 401);
    return ok({ courier: publicCourier(courier), stats: await courierStats(courier) });
  });
}
