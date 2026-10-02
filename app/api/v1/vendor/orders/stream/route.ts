import { requireVendor } from "@/lib/auth/vendor-session";
import { orderBoard, vendorSummary } from "@/lib/services/vendor";

/**
 * GET /api/v1/vendor/orders/stream — Server-Sent Events ile canlı sipariş panosu.
 *
 * Restoran tableti bu akışa bağlı kalır; yeni sipariş düştüğünde panel zili
 * çalar ve kart listeye eklenir. İstemci, `incoming` listesindeki yeni
 * sipariş kimliklerini karşılaştırarak bildirimi tetikler.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TICK_MS = 2000;

export async function GET(request: Request) {
  const { restaurant } = await requireVendor(request);
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
        board: orderBoard(restaurant.id),
        summary: vendorSummary(restaurant.id),
        at: new Date().toISOString(),
      });

      controller.enqueue(encoder.encode("retry: 3000\n\n"));
      send("board", payload());

      timer = setInterval(() => send("board", payload()), TICK_MS);
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
