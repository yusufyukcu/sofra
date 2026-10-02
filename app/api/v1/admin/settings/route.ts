import { handle, ok, readJson } from "@/lib/api/respond";
import { requireAdmin } from "@/lib/auth/admin-session";
import { recordAudit } from "@/lib/db/queries";
import { appSettings, updateAppSettings } from "@/lib/db/settings";
import { DomainError } from "@/lib/errors";

/** GET /api/v1/admin/settings — demo modu ve simülasyon hızı */
export async function GET(request: Request) {
  return handle(async () => {
    await requireAdmin(request);
    return ok({ settings: await appSettings() });
  });
}

/**
 * PATCH /api/v1/admin/settings
 * Body: { demoMode?: boolean, simSpeed?: number (1–60) }
 *
 * Demo modu açıkken vardiyada kurye yoksa teslimatı simülasyon üstlenir,
 * süreler `simSpeed` kat hızlı akar ve müşteri demo girişi açıktır.
 * Kapalıyken siparişler yalnızca gerçek kuryelerle, gerçek sürede ilerler.
 */
export async function PATCH(request: Request) {
  return handle(async () => {
    const admin = await requireAdmin(request);
    const body = await readJson<{ demoMode?: unknown; simSpeed?: unknown }>(request);
    const patch: { demoMode?: boolean; simSpeed?: number } = {};

    if (body.demoMode !== undefined) {
      if (typeof body.demoMode !== "boolean") throw new DomainError("invalid_setting", "demoMode true ya da false olmalı.");
      patch.demoMode = body.demoMode;
    }
    if (body.simSpeed !== undefined) {
      const speed = Number(body.simSpeed);
      if (!Number.isFinite(speed) || speed < 1 || speed > 60) {
        throw new DomainError("invalid_setting", "Simülasyon hızı 1 ile 60 arasında olmalı.");
      }
      patch.simSpeed = speed;
    }

    const settings = await updateAppSettings(patch);
    await recordAudit(
      admin.name,
      "Platform ayarını değiştirdi",
      "app_settings",
      `demo modu ${settings.demoMode ? "açık" : "kapalı"}, hız ${settings.simSpeed}×`
    );
    return ok({ settings });
  });
}
