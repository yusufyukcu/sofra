import { handle, ok, readJson } from "@/lib/api/respond";
import { startOtp } from "@/lib/services/auth";

/**
 * POST /api/v1/auth/otp/start
 * Body: { channel: "phone" | "email", target: string }
 *
 * Prototipte doğrulama kodu cevapta `devCode` olarak döner. Gerçek sistemde
 * SMS/e-posta ile gönderilir ve bu alan kaldırılır.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const body = await readJson<{ channel?: string; target?: string }>(request);
    const channel = body.channel === "email" ? "email" : "phone";
    const result = startOtp(channel, body.target ?? "");
    return ok(result);
  });
}
