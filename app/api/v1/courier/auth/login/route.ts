import { handle, ok } from "@/lib/api/respond";
import { appSettings } from "@/lib/db/settings";
import { courierPickerList } from "@/lib/services/courier";

/**
 * GET /api/v1/courier/auth/login — demo giriş ekranının kurye listesi.
 *
 * Giriş telefon + doğrulama koduyla yapılır:
 *   POST /api/v1/courier/auth/otp/start  { phone }
 *   POST /api/v1/courier/auth/otp/verify { challengeId, code }
 * Telefon numaraları yalnızca demo modunda listelenir.
 */
export async function GET() {
  return handle(async () => {
    const settings = await appSettings();
    return ok({ couriers: await courierPickerList(settings.demoMode), demo: settings.demoMode });
  });
}
