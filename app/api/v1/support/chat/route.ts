import { handle, ok, readJson } from "@/lib/api/respond";
import { requireUser } from "@/lib/auth/session";
import { chat, getOrCreateSession, type ChatInput } from "@/lib/services/support";

/** GET /api/v1/support/chat — mevcut destek oturumunu getirir/başlatır */
export async function GET(request: Request) {
  return handle(async () => {
    const user = await requireUser(request);
    const params = new URL(request.url).searchParams;
    const session = getOrCreateSession(
      user,
      params.get("sessionId") ?? undefined,
      params.get("orderId") ?? undefined
    );
    return ok({ session });
  });
}

/**
 * POST /api/v1/support/chat
 * Body: { sessionId?, text?, quickReplyId?, orderId? }
 *
 * Kural tabanlı asistan; sipariş takibi, iptal, eksik ürün ve iade
 * konularını karşılar, gerekirse canlı temsilciye devreder.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser(request);
    const body = await readJson<ChatInput>(request);
    const session = chat(user, body);
    return ok({ session });
  });
}
