import { handle, ok, readJson } from "@/lib/api/respond";
import { clientIp } from "@/lib/api/request";
import { startOtp } from "@/lib/services/auth";

/**
 * POST /api/v1/auth/otp/start
 * Body: { channel: "phone" | "email", target: string }
 *
 * SMS/e-posta sağlayıcısı bağlı değilken (test modu) kod cevapta
 * `devCode` olarak döner. Sağlayıcı bağlanınca bu alan gelmez.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const body = await readJson<{ channel?: string; target?: string }>(request);
    const channel = body.channel === "email" ? "email" : "phone";
    return ok(await startOtp("customer", channel, body.target ?? "", clientIp(request)));
  });
}
