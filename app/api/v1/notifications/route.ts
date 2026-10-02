import { handle, ok, readJson } from "@/lib/api/respond";
import { requireUser } from "@/lib/auth/session";
import { DomainError } from "@/lib/errors";
import { pushConfigured } from "@/lib/push";
import { listNotifications, markRead, sendTestNotification } from "@/lib/services/notifications";

/** GET /api/v1/notifications — bildirim kutusu, okunmamış sayısı ve push durumu */
export async function GET(request: Request) {
  return handle(async () => {
    const user = await requireUser(request);
    return ok({ ...(await listNotifications(user.id)), pushAvailable: pushConfigured() });
  });
}

/**
 * POST /api/v1/notifications
 * Body: { action: "read", ids? }  → okundu işaretle (ids yoksa tümü)
 *       { action: "test" }        → kendine deneme bildirimi
 */
export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser(request);
    const body = await readJson<{ action?: string; ids?: string[] }>(request);
    if (body.action === "read") return ok({ unread: await markRead(user.id, body.ids) });
    if (body.action === "test") {
      await sendTestNotification(user.id);
      return ok({ sent: true });
    }
    throw new DomainError("unknown_action", "Geçersiz işlem. Beklenen: read, test.");
  });
}
