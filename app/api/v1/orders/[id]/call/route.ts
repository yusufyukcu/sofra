import { handle, ok, readJson } from "@/lib/api/respond";
import { requireUser } from "@/lib/auth/session";
import { endCall, startCall } from "@/lib/services/calls";

/**
 * POST /api/v1/orders/:id/call
 * Body: { action?: "start" } → kuryeyi maskeli hattan arama oturumu
 *       { action: "end", sessionId, durationSeconds } → görüşme kaydı
 *
 * Müşteri kuryesini platform hattından arar; iki taraf da birbirinin
 * numarasını görmez.
 */
export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const user = await requireUser(request);
    const { id } = await ctx.params;
    const body = await readJson<{ action?: string; sessionId?: string; durationSeconds?: number }>(request);
    if (body.action === "end") {
      await endCall("customer", user.id, id, String(body.sessionId ?? ""), Number(body.durationSeconds));
      return ok({ ended: true });
    }
    return ok({ call: await startCall("customer", user.id, id) });
  });
}
