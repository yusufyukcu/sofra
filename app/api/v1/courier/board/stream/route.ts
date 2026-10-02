import { requireCourier } from "@/lib/auth/courier-session";
import { publicCourier } from "@/lib/auth/courier-session";
import { findCourier } from "@/lib/db/store";
import { courierBoard } from "@/lib/services/courier";

/**
 * GET /api/v1/courier/board/stream — Server-Sent Events.
 *
 * Kurye uygulaması vardiya boyunca bu akışa bağlı kalır: yeni teklif
 * düştüğünde kart anında belirir ve kalan süre saniye saniye sayar.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TICK_MS = 1000;

export async function GET(request: Request) {
  const session = await requireCourier(request);
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

      const payload = () => {
        // Kurye kaydı akış boyunca değişir (vardiya, konum) — tazele
        const courier = findCourier(session.id);
        if (!courier) return null;
        const board = courierBoard(courier);
        return { ...board, courier: publicCourier(board.courier) };
      };

      controller.enqueue(encoder.encode("retry: 3000\n\n"));
      const initial = payload();
      if (initial) send("board", initial);

      timer = setInterval(() => {
        const data = payload();
        if (!data) {
          close();
          return;
        }
        send("board", data);
      }, TICK_MS);

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
