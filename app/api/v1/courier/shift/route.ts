import { handle, ok, readJson } from "@/lib/api/respond";
import { publicCourier, requireCourier } from "@/lib/auth/courier-session";
import { courierStats, setShift } from "@/lib/services/courier";
import type { LatLng } from "@/lib/types";

/**
 * POST /api/v1/courier/shift
 * Body: { online: boolean, point?: { lat, lng } }
 *
 * Mesai başlatma / bitirme. Açarken cihazın konumu gönderilir; konumu son
 * 5 dakikada gelmeyen kurye teklif almaz. Açık teslimat varken mesai
 * kapatılamaz.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const courier = await requireCourier(request);
    const body = await readJson<{ online?: boolean; point?: LatLng }>(request);
    // Mesai açılınca bekleyen siparişler için teklif hemen üretilir (setShift içinde)
    const updated = await setShift(courier, Boolean(body.online), body.point ?? null);
    return ok({ courier: publicCourier(updated), stats: await courierStats(updated) });
  });
}
