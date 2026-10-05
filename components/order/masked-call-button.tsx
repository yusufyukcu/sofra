"use client";

import { Phone, PhoneOff, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api, errorMessage } from "@/lib/api-client";
import type { CallSession } from "@/lib/services/calls";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";

type Phase = "ringing" | "connected" | "ended";

function clock(seconds: number): string {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * Maskeli arama düğmesi.
 *
 * Basılınca sunucudan geçici bir platform hattı oturumu alınır (sanal
 * numara + dahili kod); gerçek numara hiçbir zaman istemciye gelmez.
 * Sesli arama sağlayıcısı bağlıyken telefon uygulaması hattı arar ve dahili
 * kodu otomatik tuşlar. Test modunda görüşme ekranda simüle edilir ve
 * süresi kaydedilir.
 */
export function MaskedCallButton({
  endpoint,
  label = "Ara",
  className,
}: {
  /** "/orders/:id/call" (müşteri) ya da "/courier/orders/:id/call" (kurye) */
  endpoint: string;
  label?: string;
  className?: string;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [call, setCall] = useState<CallSession | null>(null);
  const [phase, setPhase] = useState<Phase>("ringing");
  const [seconds, setSeconds] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // Simülasyon: 2,5 sn çalar, sonra bağlanır ve süre işler
  useEffect(() => {
    if (!call?.testMode || phase === "ended") return;
    if (phase === "ringing") {
      const t = setTimeout(() => setPhase("connected"), 2500);
      timers.current.push(t);
      return () => clearTimeout(t);
    }
    const tick = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(tick);
  }, [call, phase]);

  async function start() {
    setBusy(true);
    try {
      const data = await api.post<{ call: CallSession }>(endpoint, { action: "start" });
      setSeconds(0);
      setPhase("ringing");
      setCall(data.call);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function hangUp() {
    if (!call) return;
    if (call.testMode) {
      void api
        .post(endpoint, { action: "end", sessionId: call.id, durationSeconds: phase === "connected" ? seconds : 0 })
        .catch(() => undefined);
    }
    setPhase("ended");
    setCall(null);
  }

  return (
    <>
      <button type="button" disabled={busy} onClick={start} className={className}>
        <Phone className="size-4" />
        {label}
      </button>

      {call && (
        <Modal
          open
          onClose={hangUp}
          title={call.testMode ? "Arama simülasyonu" : "Maskeli hat"}
          description={call.calleeLabel}
          size="sm"
          footer={
            call.testMode ? (
              <Button variant="danger" block size="lg" onClick={hangUp}>
                <PhoneOff className="size-5" />
                Görüşmeyi bitir
              </Button>
            ) : (
              <a
                href={call.dial}
                className="flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-base font-semibold text-brand-contrast"
              >
                <Phone className="size-5" />
                Platform hattını ara
              </a>
            )
          }
        >
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <span className="relative flex size-20 items-center justify-center">
              {call.testMode && phase === "ringing" && (
                <span className="animate-pulse-ring absolute inset-0 rounded-full bg-pistachio/40" />
              )}
              <span
                className={cn(
                  "relative flex size-20 items-center justify-center rounded-full",
                  phase === "connected" ? "bg-pistachio-soft text-pistachio" : "bg-surface-2 text-ink"
                )}
              >
                <Phone className="size-8" strokeWidth={1.9} aria-hidden />
              </span>
            </span>

            <p className="font-display tabular text-2xl font-extrabold text-ink">
              {call.testMode ? (phase === "ringing" ? "Çalıyor…" : clock(seconds)) : call.proxyNumber}
            </p>

            <div className="tabular w-full rounded-xl bg-surface-2 px-4 py-3 text-sm">
              <p className="text-muted">
                Platform hattı <span className="font-bold text-ink">{call.proxyNumber}</span>
              </p>
              <p className="text-muted">
                Dahili kod <span className="font-bold text-ink">{call.extension}</span>
                {!call.testMode && " (otomatik tuşlanır)"}
              </p>
            </div>

            <p className="flex items-start gap-1.5 text-left text-xs leading-relaxed text-muted">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-pistachio" />
              {call.testMode
                ? "Test modu: gerçek arama yapılmaz. Sesli arama sağlayıcısı bağlandığında bu ekran platform hattını arar; iki taraf da birbirinin numarasını görmez."
                : "İki taraf da yalnızca platform hattını görür. Hat, sipariş kapanınca kullanılamaz."}
            </p>
          </div>
        </Modal>
      )}
    </>
  );
}
