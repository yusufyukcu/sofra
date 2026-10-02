import { handle, ok, readJson } from "@/lib/api/respond";
import { requireAdmin } from "@/lib/auth/admin-session";
import { agentAct, agentSession, type AgentAction } from "@/lib/services/support";

/** GET /api/v1/admin/support/:id — konuşma, müşteri bilgisi ve son siparişleri */
export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    await requireAdmin(request);
    const { id } = await ctx.params;
    return ok(await agentSession(id));
  });
}

/**
 * POST /api/v1/admin/support/:id
 * Body: { action: "claim" | "message" | "release" | "close", text? }
 * Mesaj yazmak bekleyen görüşmeyi otomatik üstlenir.
 */
export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const admin = await requireAdmin(request);
    const { id } = await ctx.params;
    const body = await readJson<{ action?: AgentAction; text?: string }>(request);
    return ok(await agentAct(admin, id, body.action as AgentAction, body.text ?? ""));
  });
}
