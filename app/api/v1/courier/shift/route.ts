import { handle, ok, readJson } from "@/lib/api/respond";
import { publicCourier, requireCourier } from "@/lib/auth/courier-session";
import { courierStats, setShift, syncOffers } from "@/lib/services/courier";

/**
 * POST /api/v1/courier/shift
 * Body: { online: boolean }
 * Mesai baslatma / bitirme. Acik teslimat varken mesai kapatilamaz.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const courier = await requireCourier(request);
    const body = await readJson<{ online?: boolean }>(request);
    const updated = setShift(courier, Boolean(body.online));
    // Mesai acilir acilmaz bekleyen siparisler icin teklif uretilsin
    syncOffers();
    return ok({ courier: publicCourier(updated), stats: courierStats(updated) });
  });
}
