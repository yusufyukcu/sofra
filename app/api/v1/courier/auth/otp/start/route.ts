import { handle, ok, readJson } from "@/lib/api/respond";
import { clientIp } from "@/lib/api/request";
import { DomainError } from "@/lib/errors";
import { startOtp } from "@/lib/services/auth";
import { courierByPhone } from "@/lib/services/courier";

/**
 * POST /api/v1/courier/auth/otp/start
 * Body: { phone }
 * Kayıtlı kuryenin telefonuna doğrulama kodu gönderir (test modunda kod
 * cevapta `devCode` olarak döner).
 */
export async function POST(request: Request) {
  return handle(async () => {
    const body = await readJson<{ phone?: string }>(request);
    const courier = await courierByPhone(body.phone ?? "");
    if (!courier) {
      throw new DomainError("courier_not_found", "Bu numarayla kayıtlı bir kurye hesabı yok.", 404);
    }
    return ok(await startOtp("courier", "phone", body.phone ?? "", clientIp(request)));
  });
}
