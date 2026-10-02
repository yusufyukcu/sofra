"use client";

import { ArrowLeft, Mail, Smartphone, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, errorMessage } from "@/lib/api-client";
import { useSession } from "@/lib/store/session";
import type { Address, User } from "@/lib/types";
import { cn, formatPhone } from "@/lib/utils";
import { Button, Field, Input } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";

/**
 * Giriş ekranı: telefon (OTP), e-posta (OTP) ve Apple/Google ile giriş.
 *
 * Prototipte SMS gönderilmediği için doğrulama kodu ekranda gösterilir.
 * Gerçek sistemde `devCode` alanı API'den kaldırılır.
 */

type Channel = "phone" | "email";
type AuthResult = { user: User; addresses?: Address[]; isNewUser: boolean };

export function LoginClient({ next }: { next: string }) {
  const router = useRouter();
  const toast = useToast();
  const status = useSession((s) => s.status);
  const applyAuth = useSession((s) => s.applyAuth);

  const [channel, setChannel] = useState<Channel>("phone");
  const [step, setStep] = useState<"target" | "code">("target");
  const [target, setTarget] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [maskedTarget, setMaskedTarget] = useState("");
  const [devCode, setDevCode] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (status === "authenticated") router.replace(next as never);
  }, [status, router, next]);

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);

  function finish(data: AuthResult) {
    applyAuth({ user: data.user, addresses: data.addresses ?? [] });
    toast.success(
      data.isNewUser
        ? `Aramıza hoş geldin ${data.user.name.split(" ")[0]}! 🎉`
        : `Tekrar hoş geldin ${data.user.name.split(" ")[0]}!`
    );
    router.replace(next as never);
  }

  async function sendCode(event?: React.FormEvent) {
    event?.preventDefault();
    setBusy(true);
    try {
      const data = await api.post<{
        challengeId: string;
        maskedTarget: string;
        expiresInSeconds: number;
        devCode: string;
      }>("/auth/otp/start", { channel, target });

      setChallengeId(data.challengeId);
      setMaskedTarget(data.maskedTarget);
      setDevCode(data.devCode);
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
      const data = await api.post<AuthResult>("/auth/otp/verify", {
        challengeId,
        code,
        name: name.trim() || undefined,
      });
      finish(data);
    } catch (err) {
      toast.error(errorMessage(err));
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  async function social(provider: "google" | "apple") {
    setBusy(true);
    try {
      finish(await api.post<AuthResult>("/auth/social", { provider }));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function demo() {
    setBusy(true);
    try {
      finish(await api.post<AuthResult>("/auth/demo"));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto grid min-h-[calc(100dvh-4rem)] max-w-6xl items-center gap-12 px-4 py-10 lg:grid-cols-2 lg:px-6">
      {/* Tanıtım tarafı */}
      <section className="hidden lg:block">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-brand text-2xl shadow-soft">
          🍽️
        </span>
        <h1 className="mt-6 text-4xl font-extrabold leading-tight tracking-tight text-text">
          Mahallendeki en iyi lezzetler,
          <br />
          <span className="text-brand">kapının önünde.</span>
        </h1>
        <p className="mt-4 max-w-md text-[15px] leading-relaxed text-muted">
          Restoranları keşfet, favorilerini kaydet, kuryeni haritadan canlı takip
          et. Tek hesapla hem web hem de yakında mobil uygulamada.
        </p>
        <ul className="mt-8 space-y-3">
          {[
            ["🛵", "Kuryeni haritadan canlı takip et"],
            ["🎟️", "Kampanya kodları ve cüzdan bakiyesi"],
            ["🏠", "Birden fazla adres, tek dokunuşla sipariş"],
            ["💬", "7/24 canlı destek ve anında iptal"],
          ].map(([emoji, text]) => (
            <li key={text} className="flex items-center gap-3 text-[15px] text-text">
              <span className="flex size-9 items-center justify-center rounded-xl bg-surface-2 text-lg">
                {emoji}
              </span>
              {text}
            </li>
          ))}
        </ul>
      </section>

      {/* Form tarafı */}
      <section className="mx-auto w-full max-w-md">
        <div className="card p-6 sm:p-8">
          {step === "code" ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setStep("target");
                  setCode("");
                }}
                className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-text"
              >
                <ArrowLeft className="size-4" />
                Geri
              </button>

              <h2 className="text-2xl font-extrabold tracking-tight text-text">
                Doğrulama kodu
              </h2>
              <p className="mt-1.5 text-sm text-muted">
                <span className="font-semibold text-text">{maskedTarget}</span>{" "}
                adresine 6 haneli kodu gönderdik.
              </p>

              {devCode && (
                <div className="mt-4 flex items-center gap-2 rounded-xl border border-info/30 bg-info-soft px-3.5 py-2.5 text-sm">
                  <Sparkles className="size-4 shrink-0 text-info" />
                  <span className="text-text">
                    Prototip modu — kodun:{" "}
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

              <form onSubmit={verify} className="mt-5 space-y-4">
                <Field label="Doğrulama kodu">
                  <Input
                    ref={codeRef}
                    value={code}
                    onChange={(e) =>
                      setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="• • • • • •"
                    className="text-center font-mono text-2xl tracking-[0.5em]"
                  />
                </Field>

                <Field
                  label="Adın soyadın"
                  hint="Yeni hesap oluşturuyorsan kuryenin sana hitap etmesi için."
                >
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ad Soyad"
                    autoComplete="name"
                  />
                </Field>

                <Button type="submit" block size="lg" loading={busy} disabled={code.length !== 6}>
                  Doğrula ve giriş yap
                </Button>

                <button
                  type="button"
                  disabled={seconds > 0 || busy}
                  onClick={() => void sendCode()}
                  className="w-full text-center text-sm font-semibold text-brand disabled:text-muted"
                >
                  {seconds > 0
                    ? `Kodu tekrar gönder (${seconds} sn)`
                    : "Kodu tekrar gönder"}
                </button>
              </form>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-extrabold tracking-tight text-text">
                Giriş yap veya kaydol
              </h2>
              <p className="mt-1.5 text-sm text-muted">
                Tek adımda hesabına eriş, sipariş vermeye başla.
              </p>

              <div className="mt-5 grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1">
                {(
                  [
                    ["phone", "Telefon", Smartphone],
                    ["email", "E-posta", Mail],
                  ] as const
                ).map(([id, label, Icon]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setChannel(id);
                      setTarget("");
                    }}
                    className={cn(
                      "flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition-colors",
                      channel === id
                        ? "bg-surface text-text shadow-sm"
                        : "text-muted hover:text-text"
                    )}
                  >
                    <Icon className="size-4" />
                    {label}
                  </button>
                ))}
              </div>

              <form onSubmit={sendCode} className="mt-5 space-y-4">
                {channel === "phone" ? (
                  <Field label="Cep telefonu numaran" required>
                    <div className="flex items-center gap-2">
                      <span className="flex h-11 shrink-0 items-center rounded-xl border border-border bg-surface-2 px-3 text-sm font-semibold text-muted">
                        🇹🇷 +90
                      </span>
                      <Input
                        value={target}
                        onChange={(e) =>
                          setTarget(e.target.value.replace(/\D/g, "").slice(0, 10))
                        }
                        placeholder="5XX XXX XX XX"
                        inputMode="tel"
                        autoComplete="tel-national"
                      />
                    </div>
                  </Field>
                ) : (
                  <Field label="E-posta adresin" required>
                    <Input
                      value={target}
                      onChange={(e) => setTarget(e.target.value)}
                      placeholder="ornek@eposta.com"
                      type="email"
                      autoComplete="email"
                    />
                  </Field>
                )}

                <Button type="submit" block size="lg" loading={busy} disabled={!target}>
                  Doğrulama kodu gönder
                </Button>
              </form>

              <div className="my-6 flex items-center gap-3">
                <span className="h-px flex-1 bg-border" />
                <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                  veya
                </span>
                <span className="h-px flex-1 bg-border" />
              </div>

              <div className="space-y-2.5">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void social("google")}
                  className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-border bg-surface text-[15px] font-semibold text-text transition-colors hover:bg-surface-2 disabled:opacity-60"
                >
                  <GoogleMark />
                  Google ile devam et
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void social("apple")}
                  className="flex h-12 w-full items-center justify-center gap-3 rounded-xl bg-text text-[15px] font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  <AppleMark />
                  Apple ile devam et
                </button>
              </div>

              <button
                type="button"
                disabled={busy}
                onClick={() => void demo()}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border-strong py-2.5 text-sm font-semibold text-muted transition-colors hover:border-brand hover:text-brand disabled:opacity-60"
              >
                <Sparkles className="size-4" />
                Demo hesabıyla hızlı giriş
              </button>

              <p className="mt-5 text-center text-xs leading-relaxed text-muted">
                Devam ederek{" "}
                <Link href="/destek" className="font-semibold text-text hover:underline">
                  Kullanım Koşulları
                </Link>{" "}
                ve{" "}
                <Link href="/destek" className="font-semibold text-text hover:underline">
                  Gizlilik Politikası
                </Link>
                &apos;nı kabul etmiş olursun.
              </p>
            </>
          )}
        </div>

        {channel === "phone" && step === "target" && target.length === 10 && (
          <p className="mt-3 text-center text-xs text-muted">
            Kod {formatPhone(target)} numarasına gönderilecek.
          </p>
        )}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.06 12.25c0-.85-.08-1.67-.22-2.45H12v4.64h6.2a5.3 5.3 0 0 1-2.3 3.48v2.9h3.72c2.18-2 3.44-4.96 3.44-8.57Z"
      />
      <path
        fill="#34A853"
        d="M12 23.5c3.11 0 5.72-1.03 7.62-2.79l-3.72-2.89c-1.03.69-2.35 1.1-3.9 1.1-3 0-5.54-2.02-6.45-4.74H1.7v2.98A11.5 11.5 0 0 0 12 23.5Z"
      />
      <path
        fill="#FBBC05"
        d="M5.55 14.18a6.9 6.9 0 0 1 0-4.36V6.84H1.7a11.5 11.5 0 0 0 0 10.32l3.85-2.98Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.69 0 3.21.58 4.4 1.72l3.3-3.3C17.71 1.26 15.1.5 12 .5A11.5 11.5 0 0 0 1.7 6.84l3.85 2.98C6.46 7.1 9 4.75 12 4.75Z"
      />
    </svg>
  );
}

function AppleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 fill-current" aria-hidden>
      <path d="M16.36 12.78c.03 2.9 2.55 3.87 2.58 3.88-.02.07-.4 1.38-1.33 2.73-.8 1.17-1.64 2.33-2.96 2.35-1.3.03-1.72-.77-3.2-.77-1.49 0-1.95.75-3.18.8-1.27.05-2.24-1.26-3.05-2.42-1.65-2.4-2.91-6.77-1.22-9.72.84-1.47 2.35-2.4 3.98-2.42 1.25-.03 2.43.84 3.2.84.76 0 2.2-1.04 3.7-.89.63.03 2.4.26 3.53 1.92-.09.06-2.11 1.24-2.09 3.7M14.1 3.9c.68-.83 1.14-1.98.01-3.9-.98.04-2.17.65-2.87 1.47-.63.73-1.18 1.9-1.03 3.02 1.09.09 2.2-.55 2.89-1.39" />
    </svg>
  );
}
