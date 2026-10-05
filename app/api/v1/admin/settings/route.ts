import { handle, ok, readJson } from "@/lib/api/respond";
import { requireAdmin } from "@/lib/auth/admin-session";
import { recordAudit } from "@/lib/db/queries";
import { appSettings, updateAppSettings } from "@/lib/db/settings";
import { DomainError } from "@/lib/errors";

/** GET /api/v1/admin/settings — platform ayarları (demo girişleri) */
export async function GET(request: Request) {
  return handle(async () => {
    await requireAdmin(request);
    return ok({ settings: await appSettings() });
  });
}

/**
 * PATCH /api/v1/admin/settings
 * Body: { demoMode?: boolean }
 *
 * Demo girişleri (sunum) açıkken giriş ekranlarında hazır demo hesapları
 * görünür. Teslimat her durumda gerçek kuryelerle, gerçek sürede ilerler —
 * simülasyon yoktur.
 */
export async function PATCH(request: Request) {
  return handle(async () => {
    const admin = await requireAdmin(request);
    const body = await readJson<{ demoMode?: unknown }>(request);
    const patch: { demoMode?: boolean } = {};

    if (body.demoMode !== undefined) {
      if (typeof body.demoMode !== "boolean") throw new DomainError("invalid_setting", "demoMode true ya da false olmalı.");
      patch.demoMode = body.demoMode;
    }

    const settings = await updateAppSettings(patch);
    await recordAudit(
      admin.name,
      "Platform ayarını değiştirdi",
      "app_settings",
      `demo girişleri ${settings.demoMode ? "açık" : "kapalı"}`
    );
    return ok({ settings });
  });
}
