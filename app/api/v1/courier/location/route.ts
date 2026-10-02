import { handle, ok, readJson } from "@/lib/api/respond";
import { publicCourier, requireCourier } from "@/lib/auth/courier-session";
import { updateLocation } from "@/lib/services/courier";
import type { LatLng } from "@/lib/types";

/**
 * POST /api/v1/courier/location
 * Body: { point: { lat, lng } }
 *
 * Cihazdan gelen konum bildirimi. Acik teslimat varsa siparisin canli
 * kurye konumu da guncellenir — musterinin takip haritasi bunu okur.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const courier = await requireCourier(request);
    const body = await readJson<{ point?: LatLng }>(request);
    const updated = await updateLocation(courier, body.point as LatLng);
    return ok({ courier: publicCourier(updated) });
  });
}
