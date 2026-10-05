"use client";

import { ArrowLeft, Sparkles, Star } from "lucide-react";
import { LogoTile } from "@/components/brand/logo";
import { Avatar } from "@/components/ui/avatar";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, errorMessage } from "@/lib/api-client";
import { useCourier, type PublicCourier } from "@/lib/store/courier";
import { cn, formatPhone } from "@/lib/utils";
import { Button, Field, Input, Skeleton } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";

interface PickerItem {
  id: string;
  name: string;
  emoji: string;
  vehicle: "moto" | "bisiklet" | "araba";
  rating: number;
  online: boolean;
  status: "pending" | "active" | "suspended";
  /** Yalnızca demo modunda gelir */
  phone?: string;
}

const VEHICLE_LABEL = { moto: "Motosiklet", bisiklet: "Bisiklet", araba: "Araç" } as const;

/**
 * Kurye girişi — telefon numarası ve tek kullanımlık kod (Supabase Auth).
 *
 * SMS sağlayıcısı bağlı değilken (test modu) kod ekranda gösterilir.
 * Demo modunda kurye listesine dokununca numara alanı dolar.
 */
export function CourierLogin() {
  const router = useRouter();
  const toast = useToast();
  const status = useCourier((s) => s.status);
  const applyAuth = useCourier((s) => s.applyAuth);
  const bootstrap = useCourier((s) => s.bootstrap);

  const [items, setItems] = useState<PickerItem[] | null>(null);
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [maskedTarget, setMaskedTarget] = useState("");
  const [devCode, setDevCode] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (status === "authenticated") router.replace("/kurye");
  }, [status, router]);

  useEffect(() => {
    api
      .get<{ couriers: PickerItem[]; demo: boolean }>("/courier/auth/login")
      .then((data) => setItems(data.demo ? data.couriers : []))
      .catch(() => setItems([]));
  }, []);

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);

  async function sendCode(event?: React.FormEvent) {
    event?.preventDefault();
    setBusy(true);
    try {
      const data = await api.post<{ challengeId: string; maskedTarget: string; devCode?: string }>(
        "/courier/auth/otp/start",
        { phone }
      );
      setChallengeId(data.challengeId);
      setMaskedTarget(data.maskedTarget);
      setDevCode(data.devCode ?? "");
      setSeconds(60);
      setStep("code");
      setTimeout(() => codeRef.current?.focus(), 80);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function verify(event?: React.FormEvent) {
    event?.preventDefault();
    setBusy(true);
    try {
      const data = await api.post<{ courier: PublicCourier }>("/courier/auth/otp/verify", {
        challengeId,
        code,
      });
      applyAuth(data.courier);
      toast.success(`Hoş geldin ${data.courier.name.split(" ")[0]}.`);
      router.replace("/kurye");
    } catch (err) {
      toast.error(errorMessage(err));
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh justify-center bg-deep">
      <div className="flex min-h-dvh w-full max-w-md flex-col bg-paper shadow-float">
        <header className="band-deep px-5 pb-8 pt-10">
          <div className="flex items-center gap-2.5">
            <LogoTile />
            <span className="font-display text-xl font-extrabold tracking-tight text-on-deep">Sofra Kurye</span>
          </div>
          <h1 className="font-display mt-6 text-[1.8rem] font-extrabold leading-tight text-on-deep">
            Vardiyanı başlat,
            <br />
            kazanmaya başla
          </h1>
          <p className="mt-2.5 text-sm leading-relaxed text-on-deep-muted">
            Yakındaki siparişler sana gönderilir. Paket başı kazancını ve bahşişlerini anlık takip edersin.
          </p>
        </header>

        {step === "code" ? (
          <form onSubmit={verify} className="flex-1 px-5 py-6">
            <button
              type="button"
              onClick={() => {
                setStep("phone");
                setCode("");
              }}
              className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink"
            >
              <ArrowLeft className="size-4" />
              Numarayı değiştir
            </button>

            <p className="text-sm text-muted">
              <span className="font-semibold text-ink">{maskedTarget}</span> numarasına 6 haneli kod gönderdik.
            </p>

            {devCode && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-info/30 bg-info-soft px-3.5 py-2.5 text-sm">
                <Sparkles className="size-4 shrink-0 text-info" />
                <span className="text-text">
                  Test modu — kodun:{" "}
                  <button
                    type="button"
                    onClick={() => setCode(devCode)}
                    className="font-mono text-base font-extrabold tracking-widest text-info hover:underline"
                  >
                    {devCode}
                  </button>
                </span>
              </div>
            )}

            <Field label="Doğrulama kodu" className="mt-5">
              <Input
                ref={codeRef}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="• • • • • •"
                className="text-center font-mono text-2xl tracking-[0.5em]"
              />
            </Field>

            <Button type="submit" block size="lg" className="mt-5 h-14" loading={busy} disabled={code.length !== 6}>
              Uygulamaya gir
            </Button>

            <button
              type="button"
              disabled={seconds > 0 || busy}
              onClick={() => void sendCode()}
              className="mt-4 w-full text-center text-sm font-semibold text-brand disabled:text-muted"
            >
              {seconds > 0 ? `Kodu tekrar gönder (${seconds} sn)` : "Kodu tekrar gönder"}
            </button>
          </form>
        ) : (
          <form onSubmit={sendCode} className="flex-1 px-5 py-6">
            <Field label="Cep telefonu numaran">
              <div className="flex items-center gap-2">
                <span className="flex h-11 shrink-0 items-center rounded-xl border border-border bg-surface-2 px-3 text-sm font-semibold text-muted">
                  🇹🇷 +90
                </span>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  placeholder="5XX XXX XX XX"
                  inputMode="tel"
                  autoComplete="tel-national"
                />
              </div>
            </Field>

            <Button type="submit" block size="lg" className="mt-5 h-14" loading={busy} disabled={phone.length !== 10}>
              Doğrulama kodu gönder
            </Button>

            {/* Demo kurye hesapları — yalnızca demo modunda */}
            {items === null ? (
              <Skeleton className="mt-8 h-40 w-full" />
            ) : items.length > 0 ? (
              <div className="mt-8">
                <p className="mb-3 text-sm font-semibold text-ink">Demo hesapları</p>
                <div className="space-y-2">
                  {items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => item.phone && setPhone(item.phone)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors",
                        phone && phone === item.phone
                          ? "border-brand bg-brand-soft"
                          : "border-border bg-surface hover:bg-surface-2"
                      )}
                    >
                      <Avatar name={item.name} className="size-11 text-sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-bold text-ink">{item.name}</span>
                        <span className="tabular block text-xs text-muted">
                          {item.phone ? formatPhone(item.phone) : ""} ·{" "}
                          <Star className="inline size-3 -translate-y-px fill-saffron text-saffron" aria-hidden />{" "}
                          {item.rating.toFixed(1)} ·{" "}
                          {VEHICLE_LABEL[item.vehicle]}
                          {item.status === "pending" && (
                            <span className="ml-1.5 font-semibold text-saffron">· onay bekliyor</span>
                          )}
                          {item.online && <span className="ml-1.5 font-semibold text-pistachio">· mesaide</span>}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <Link href="/" className="mt-6 block text-center text-sm font-medium text-muted hover:text-ink">
              ← Müşteri uygulamasına dön
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
