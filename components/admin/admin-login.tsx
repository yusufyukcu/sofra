"use client";

import { ShieldCheck } from "lucide-react";
import { LogoTile } from "@/components/brand/logo";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api-client";
import { useAdmin, type AdminProfile } from "@/lib/store/admin";
import { Button, Field, Input } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";

/**
 * Yönetici girişi — e-posta ve parola (Supabase Auth). Oturum girişten
 * 4 saat sonra kapanır. Demo bilgisi yalnızca geliştirme ortamında görünür.
 */
export function AdminLogin({ demo }: { demo?: { email: string; password: string } }) {
  const router = useRouter();
  const toast = useToast();
  const status = useAdmin((s) => s.status);
  const applyAuth = useAdmin((s) => s.applyAuth);
  const bootstrap = useAdmin((s) => s.bootstrap);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      const data = await api.post<{ admin: AdminProfile }>("/admin/auth/login", { email, password });
      applyAuth(data.admin);
      toast.success("Yönetim paneline hoş geldin.");
      router.replace("/yonetim");
    } catch (err) {
      toast.error(errorMessage(err));
      setPassword("");
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    "border-white/15 bg-white/10 text-on-deep placeholder:text-on-deep-muted focus:border-brand";

  return (
    <div className="band-deep flex min-h-dvh items-center justify-center p-5">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2.5">
          <LogoTile />
          <span className="font-display text-xl font-extrabold tracking-tight text-on-deep">Sofra Yönetim</span>
        </div>

        <h1 className="font-display text-[1.9rem] font-extrabold leading-tight text-on-deep">
          Platform kontrol masası
        </h1>
        <p className="mt-2.5 text-sm leading-relaxed text-on-deep-muted">
          Canlı operasyon, restoran ve kurye onayları, kampanyalar ve finansal mutabakat — hepsi tek ekranda.
        </p>

        <form onSubmit={submit} className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
          <Field label="E-posta">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="yonetici@ornek.com"
              autoComplete="username"
              autoFocus
              className={inputClass}
            />
          </Field>
          <Field label="Parola" className="mt-4">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              className={inputClass}
            />
          </Field>

          {demo && (
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand" />
              <span className="text-on-deep-muted">
                Geliştirme ortamı demo hesabı:{" "}
                <button
                  type="button"
                  onClick={() => {
                    setEmail(demo.email);
                    setPassword(demo.password);
                  }}
                  className="font-semibold text-on-deep hover:underline"
                >
                  {demo.email}
                </button>
              </span>
            </div>
          )}

          <Button type="submit" block size="lg" className="mt-5" loading={busy} disabled={!email || password.length < 6}>
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
