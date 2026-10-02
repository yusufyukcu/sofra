import { handle, ok, readJson } from "@/lib/api/respond";
import { publicCourier, requireCourier } from "@/lib/auth/courier-session";
import { courierStats, setShift } from "@/lib/services/courier";

/**
 * POST /api/v1/courier/shift
 * Body: { online: boolean }
 * Mesai baslatma / bitirme. Acik teslimat varken mesai kapatilamaz.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const courier = await requireCourier(request);
    const body = await readJson<{ online?: boolean }>(request);
    // Mesai açılınca bekleyen siparişler için teklif hemen üretilir (setShift içinde)
    const updated = await setShift(courier, Boolean(body.online));
    return ok({ courier: publicCourier(updated), stats: await courierStats(updated) });
  });
}
