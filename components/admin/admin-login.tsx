"use client";

import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api-client";
import { useAdmin, type AdminProfile } from "@/lib/store/admin";
import { Button, Field, Input } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";

/**
 * Yönetici girişi.
 *
 * Prototipte tek hesap ve PIN. Üretimde kurumsal SSO veya parola + iki
 * adımlı doğrulama olur; oturum süresi burada da kısa tutuldu (4 saat).
 */
export function AdminLogin() {
  const router = useRouter();
  const toast = useToast();
  const status = useAdmin((s) => s.status);
  const applyAuth = useAdmin((s) => s.applyAuth);
  const bootstrap = useAdmin((s) => s.bootstrap);

  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (status === "authenticated") router.replace("/yonetim");
  }, [status, router]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const data = await api.post<{ admin: AdminProfile }>(
        "/admin/auth/login",
        { pin }
      );
      applyAuth(data.admin);
      toast.success("Yönetim paneline hoş geldin.");
      router.replace("/yonetim");
    } catch (err) {
      toast.error(errorMessage(err));
      setPin("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="band-deep flex min-h-dvh items-center justify-center p-5">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2.5">
          <span className="flex size-10 items-center justify-center rounded-xl bg-brand text-xl">
            🍽️
          </span>
          <span className="font-display text-xl font-extrabold tracking-tight text-on-deep">
            Sofra Yönetim
          </span>
        </div>

        <h1 className="font-display text-[1.9rem] font-extrabold leading-tight text-on-deep">
          Platform kontrol masası
        </h1>
        <p className="mt-2.5 text-sm leading-relaxed text-on-deep-muted">
          Canlı operasyon, restoran ve kurye onayları, kampanyalar ve
          finansal mutabakat — hepsi tek ekranda.
        </p>

        <form
          onSubmit={submit}
          className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur"
        >
          <Field label="Yönetici PIN">
            <Input
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              placeholder="••••"
              autoComplete="off"
              autoFocus
              className="border-white/15 bg-white/10 text-center font-mono text-2xl tracking-[0.5em] text-on-deep placeholder:text-on-deep-muted focus:border-brand"
            />
          </Field>

          <div className="mt-3 flex items-start gap-2 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand" />
            <span className="text-on-deep-muted">
              Prototip PIN&apos;i:{" "}
              <button
                type="button"
                onClick={() => setPin("1234")}
                className="font-mono font-extrabold text-on-deep hover:underline"
              >
                1234
              </button>
            </span>
          </div>

          <Button
            type="submit"
            block
            size="lg"
            className="mt-5"
            loading={busy}
            disabled={pin.length < 4}
          >
            Panele gir
          </Button>
        </form>

        <Link
          href="/"
          className="mt-6 block text-center text-sm font-medium text-on-deep-muted transition-colors hover:text-on-deep"
        >
          ← Müşteri uygulamasına dön
        </Link>
      </div>
    </div>
  );
}
