import { requireAdmin } from "@/lib/auth/admin-session";
import { db } from "@/lib/db/store";
import { adminOverview } from "@/lib/services/admin";

/**
 * GET /api/v1/admin/overview/stream — Server-Sent Events.
 *
 * Canlı operasyon ekranı: tüm aktif siparişler, kurye konumları ve gecikme
 * alarmları saniyede bir yayınlanır.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TICK_MS = 2000;

export async function GET(request: Request) {
  await requireAdmin(request);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let timer: ReturnType<typeof setInterval> | null = null;

      const close = () => {
        if (closed) return;
        closed = true;
        if (timer) clearInterval(timer);
        try {
          controller.close();
        } catch {
          /* akış zaten kapalı */
        }
      };

      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          close();
        }
      };

      const payload = () => ({
        ...adminOverview(),
        audit: db().audit.slice(0, 12),
      });

      controller.enqueue(encoder.encode("retry: 3000\n\n"));
      send("overview", payload());

      timer = setInterval(() => send("overview", payload()), TICK_MS);
      request.signal.addEventListener("abort", close);
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
