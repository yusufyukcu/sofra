import { handle, ok, readJson } from "@/lib/api/respond";
import { requireCourier } from "@/lib/auth/courier-session";
import { endCall, startCall } from "@/lib/services/calls";

/**
 * POST /api/v1/courier/orders/:id/call
 * Body: { action?: "start" } → maskeli arama oturumu (sanal numara + dahili kod)
 *       { action: "end", sessionId, durationSeconds } → görüşme kaydı
 *
 * Kurye müşteriyi platform hattından arar; müşterinin numarası kuryeye
 * hiçbir zaman gönderilmez.
 */
export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const courier = await requireCourier(request);
    const { id } = await ctx.params;
    const body = await readJson<{ action?: string; sessionId?: string; durationSeconds?: number }>(request);
    if (body.action === "end") {
      await endCall("courier", courier.id, id, String(body.sessionId ?? ""), Number(body.durationSeconds));
      return ok({ ended: true });
    }
    return ok({ call: await startCall("courier", courier.id, id) });
  });
}
