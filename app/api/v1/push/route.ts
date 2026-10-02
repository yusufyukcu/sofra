import { handle, ok, readJson } from "@/lib/api/respond";
import { requireUser } from "@/lib/auth/session";
import { DomainError } from "@/lib/errors";
import {
  pushSubscriptionCount,
  subscribePush,
  unsubscribePush,
  type PushSubscriptionInput,
} from "@/lib/services/notifications";

/**
 * POST /api/v1/push
 * Body: { action: "subscribe", subscription: PushSubscriptionJSON }
 *       { action: "unsubscribe", endpoint }
 *
 * Tarayıcı aboneliği (Web Push / VAPID). Uygulama kapalıyken de sipariş
 * durumu ve kampanya bildirimleri cihaza gelir.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser(request);
    const body = await readJson<{
      action?: string;
      subscription?: PushSubscriptionInput;
      endpoint?: string;
    }>(request);

    if (body.action === "subscribe") {
      await subscribePush(user.id, body.subscription ?? {}, request.headers.get("user-agent"));
    } else if (body.action === "unsubscribe") {
      await unsubscribePush(user.id, String(body.endpoint ?? ""));
    } else {
      throw new DomainError("unknown_action", "Geçersiz işlem. Beklenen: subscribe, unsubscribe.");
    }
    return ok({ devices: await pushSubscriptionCount(user.id) });
  });
}
