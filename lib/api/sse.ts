/**
 * Server-Sent Events yardımcısı.
 *
 * Bağlantı açık kaldıkça `load` belirli aralıkla çağrılır ve sonucu olay
 * olarak gönderilir. Aynı içerik art arda gönderilmez (değişmeyen pano
 * için ağ trafiği yok). `done` dönerse akış kapanır.
 */

export interface SseFrame {
  event: string;
  data: unknown;
  /** Bu kareden sonra akışı kapat */
  done?: boolean;
}

export function sseResponse(
  request: Request,
  options: { intervalMs: number; load: () => Promise<SseFrame | null> }
): Response {
  const encoder = new TextEncoder();
  let closed = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastPayload = "";

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const close = () => {
        if (closed) return;
        closed = true;
        if (timer) clearTimeout(timer);
        try {
          controller.close();
        } catch {
          /* akış zaten kapalı */
        }
      };

      const write = (text: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          close();
        }
      };

      const tick = async () => {
        if (closed) return;
        try {
          const frame = await options.load();
          if (frame) {
            const payload = JSON.stringify(frame.data);
            if (payload !== lastPayload) {
              lastPayload = payload;
              write(`event: ${frame.event}\ndata: ${payload}\n\n`);
            } else {
              // Vekiller bağlantıyı boşta sanıp kesmesin
              write(": canlı\n\n");
            }
            if (frame.done) {
              close();
              return;
            }
          }
        } catch (err) {
          console.warn("[sofra/sse]", err instanceof Error ? err.message : err);
        }
        if (!closed) timer = setTimeout(tick, options.intervalMs);
      };

      write("retry: 3000\n\n");
      void tick();
      request.signal.addEventListener("abort", close);
    },
    cancel() {
      closed = true;
      if (timer) clearTimeout(timer);
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
