import { handle, ok, readJson } from "@/lib/api/respond";
import { requireVendor } from "@/lib/auth/vendor-session";
import {
  updateStoreSettings,
  type StoreSettingsInput,
} from "@/lib/services/vendor";

/** GET /api/v1/vendor/settings — magaza ayarlari */
export async function GET(request: Request) {
  return handle(async () => {
    const { restaurant } = await requireVendor(request);
    return ok({ restaurant });
  });
}

/**
 * PATCH /api/v1/vendor/settings
 * Calisma saatleri, mola, minimum sepet, teslimat yaricapi, gecici kapatma,
 * otomatik onay ve odeme yontemleri tek uc noktadan guncellenir.
 */
export async function PATCH(request: Request) {
  return handle(async () => {
    const { restaurant } = await requireVendor(request);
    const body = await readJson<StoreSettingsInput>(request);
    return ok({ restaurant: await updateStoreSettings(restaurant.id, body) });
  });
}
