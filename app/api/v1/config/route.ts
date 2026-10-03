import { handle, ok } from "@/lib/api/respond";
import { appSettings } from "@/lib/db/settings";
import { isTestMode } from "@/lib/messaging";
import { pushConfigured } from "@/lib/push";
import { paymentSimulated } from "@/lib/services/cards";
import { voiceTestMode } from "@/lib/services/calls";

/**
 * GET /api/v1/config — istemcilerin arayüzünü uyarlaması için genel ayarlar
 * (kimlik doğrulama gerekmez). Demo modu kapalıyken demo girişi gösterilmez;
 * test modundaki servisler arayüzde belirtilebilir.
 */
export async function GET() {
  return handle(async () => {
    const settings = await appSettings();
    return ok(
      {
        demoMode: settings.demoMode,
        testModes: {
          sms: isTestMode("phone"),
          email: isTestMode("email"),
          voice: voiceTestMode(),
          payment: paymentSimulated(),
        },
        webPush: pushConfigured(),
      },
      { headers: { "cache-control": "no-store" } }
    );
  });
}
