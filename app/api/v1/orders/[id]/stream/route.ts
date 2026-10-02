import { requireUser } from "@/lib/auth/session";
import { progressOf, remainingMinutes, syncOrder } from "@/lib/db/simulator";
import { findOrder } from "@/lib/db/store";
import type { Order } from "@/lib/types";

/**
 * GET /api/v1/orders/:id/stream — Server-Sent Events ile canlı sipariş takibi.
 *
 * Sipariş durumu, kurye konumu ve kalan süre saniyede bir yayınlanır.
 * Sipariş teslim edildiğinde veya iptal olduğunda akış kapanır.
 *
 * Neden SSE? Tek yönlü (sunucu → istemci) bir yayın için WebSocket'e göre
 * daha basit, HTTP/2 üzerinde verimli ve tarayıcıda otomatik yeniden
 * bağlanma desteği var. Kurye/Restoran panelleri devreye girdiğinde çift
 * yönlü iletişim gerektiren yerler için WebSocket'e geçilebilir; istemci
 * sözleşmesi (`order`, `progress`, `remainingMinutes`) aynı kalır.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TICK_MS = 1000;

function payload(order: Order) {
  return {
    order,
    progress: progressOf(order),
    remainingMinutes: remainingMinutes(order),
  };
}

export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const user = await requireUser(request);
  const { id } = await ctx.params;

  const initial = findOrder(id);
  if (!initial || initial.userId !== user.id) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: { code: "order_not_found", message: "Sipariş bulunamadı." },
      }),
      { status: 404, headers: { "content-type": "application/json" } }
    );
  }

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

      // Tarayıcıya yeniden bağlanma aralığını bildir
      controller.enqueue(encoder.encode("retry: 3000\n\n"));

      syncOrder(initial);
      send("update", payload(initial));

      timer = setInterval(() => {
        const order = findOrder(id);
        if (!order) {
          send("error", { code: "order_not_found" });
          close();
          return;
        }
        syncOrder(order);
        send("update", payload(order));

        if (order.status === "delivered" || order.status === "cancelled") {
          send("done", { status: order.status });
          close();
        }
      }, TICK_MS);

      request.signal.addEventListener("abort", close);
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      // Ters vekil sunucuların (nginx) tamponlamasını engelle
      "x-accel-buffering": "no",
    },
  });
}
