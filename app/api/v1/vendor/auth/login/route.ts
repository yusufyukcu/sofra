import { handle, ok, readJson } from "@/lib/api/respond";
import { vendorPasswordLogin, vendorSessionResponse } from "@/lib/auth/vendor-session";
import { appSettings } from "@/lib/db/settings";
import { demoVendorAccounts, vendorSummary } from "@/lib/services/vendor";

/**
 * GET /api/v1/vendor/auth/login — demo modunda tohum işletme hesapları
 * (giriş e-postasını doldurmak için). Demo kapalıysa liste boş döner.
 */
export async function GET() {
  return handle(async () => {
    const settings = await appSettings();
    return ok({ demo: settings.demoMode, accounts: settings.demoMode ? await demoVendorAccounts() : [] });
  });
}

/** POST /api/v1/vendor/auth/login — Body: { email, password } */
export async function POST(request: Request) {
  return handle(async () => {
    const body = await readJson<{ email?: string; password?: string }>(request);
    const { vendor, restaurant, session } = await vendorPasswordLogin(body.email ?? "", body.password ?? "");
    return vendorSessionResponse(vendor, restaurant, session, {
      summary: await vendorSummary(restaurant.id),
    });
  });
}
