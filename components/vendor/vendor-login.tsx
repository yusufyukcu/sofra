"use client";

import { Eye, EyeOff, Search, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api, errorMessage } from "@/lib/api-client";
import { useVendor } from "@/lib/store/vendor";
import type { Restaurant } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button, Field, Input, Skeleton } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";

interface DemoAccount {
  restaurantId: string;
  name: string;
  emoji: string;
  district: string;
  email: string;
}

/**
 * İşletme girişi — e-posta ve parola (Supabase Auth).
 *
 * Demo modunda tohum restoranların hesapları listelenir; birine dokununca
 * e-posta alanı dolar. Demo parolası yalnızca geliştirme ortamında
 * gösterilir (sunucu sayfası `demoPassword` olarak verir).
 */
export function VendorLogin({ demoPassword }: { demoPassword?: string }) {
  const router = useRouter();
  const toast = useToast();
  const status = useVendor((s) => s.status);
  const applyAuth = useVendor((s) => s.applyAuth);
  const bootstrap = useVendor((s) => s.bootstrap);

  const [accounts, setAccounts] = useState<DemoAccount[] | null>(null);
  const [query, setQuery] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (status === "authenticated") router.replace("/isletme");
  }, [status, router]);

  useEffect(() => {
    api
      .get<{ demo: boolean; accounts: DemoAccount[] }>("/vendor/auth/login")
      .then((data) => setAccounts(data.accounts))
      .catch(() => setAccounts([]));
  }, []);

  const filtered = useMemo(() => {
    if (!accounts) return [];
    const q = query.trim().toLocaleLowerCase("tr");
    if (!q) return accounts;
    return accounts.filter(
      (item) =>
        item.name.toLocaleLowerCase("tr").includes(q) ||
        item.district.toLocaleLowerCase("tr").includes(q)
    );
  }, [accounts, query]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const data = await api.post<{
        vendor: { id: string; name: string; email: string };
        restaurant: Restaurant;
      }>("/vendor/auth/login", { email, password });

      applyAuth({ vendor: data.vendor, restaurant: data.restaurant });
      toast.success(`${data.restaurant.name} paneline hoş geldin.`);
      router.replace("/isletme");
    } catch (err) {
      toast.error(errorMessage(err));
      setPassword("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      {/* Tanıtım tarafı */}
      <section className="band-deep hidden flex-col justify-between p-10 lg:flex">
        <div className="flex items-center gap-2.5">
          <span className="flex size-10 items-center justify-center rounded-xl bg-brand text-xl">🍽️</span>
          <span className="font-display text-xl font-extrabold tracking-tight text-on-deep">Sofra İşletme</span>
        </div>

        <div className="max-w-md">
          <h1 className="font-display text-[2.5rem] font-extrabold leading-[1.05] text-on-deep">
            Mutfağın kontrol masası
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-on-deep-muted">
            Siparişleri anında gör ve onayla, menünü ve stoğunu tek ekrandan yönet, cironu ve
            hakedişlerini takip et.
          </p>

          <ul className="mt-9 space-y-3.5">
            {[
              ["🔔", "Yeni sipariş düştüğünde zil çalar"],
              ["⏱️", "Hazırlık süresini bildir, müşteri anında görsün"],
              ["🍽️", "Ürün ekle, fiyat güncelle, tükeneni kapat"],
              ["📊", "Günlük ciro, komisyon ve hakediş tabloları"],
            ].map(([emoji, text]) => (
              <li key={text} className="flex items-center gap-3 text-[15px] text-on-deep">
                <span className="flex size-9 items-center justify-center rounded-xl bg-white/10 text-lg">
                  {emoji}
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <Link
          href="/"
          className="text-sm font-semibold text-on-deep-muted transition-colors hover:text-on-deep"
        >
          ← Müşteri uygulamasına dön
        </Link>
      </section>

      {/* Form tarafı */}
      <section className="flex items-center justify-center bg-paper p-5 sm:p-10">
        <form onSubmit={submit} className="w-full max-w-md">
          <h2 className="font-display text-2xl font-extrabold text-ink">İşletme girişi</h2>
          <p className="mt-1.5 text-sm text-muted">Panel hesabının e-posta adresi ve parolasıyla gir.</p>

          <Field label="E-posta" className="mt-6">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="isletme@ornek.com"
              autoComplete="username"
            />
          </Field>

          <Field label="Parola" className="mt-4">
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="pr-11"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Parolayı gizle" : "Parolayı göster"}
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted hover:text-ink"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </Field>

          <Button
            type="submit"
            block
            size="lg"
            className="mt-5"
            loading={busy}
            disabled={!email || password.length < 6}
          >
            Panele gir
          </Button>

          {/* Demo hesapları — yalnızca demo modunda */}
          {accounts === null ? (
            <Skeleton className="mt-8 h-40 w-full" />
          ) : accounts.length > 0 ? (
            <div className="mt-8">
              <div className="flex items-start gap-2 rounded-xl border border-info/25 bg-info-soft px-3.5 py-2.5 text-sm">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-info" />
                <span className="text-text">
                  Demo modu: bir restorana dokun, e-postası dolsun.
                  {demoPassword ? (
                    <>
                      {" "}
                      Parola:{" "}
                      <button
                        type="button"
                        onClick={() => setPassword(demoPassword)}
                        className="font-mono font-extrabold text-info hover:underline"
                      >
                        {demoPassword}
                      </button>
                    </>
                  ) : (
                    " Demo parolası .env.development.local dosyasındaki SOFRA_DEMO_PASSWORD."
                  )}
                </span>
              </div>

              <label className="mt-3 flex h-11 items-center gap-2 rounded-xl border border-border bg-surface px-3 focus-within:border-brand">
                <Search className="size-4 shrink-0 text-muted" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Restoran ara"
                  aria-label="Restoran ara"
                  className="min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-muted focus:outline-none"
                />
              </label>

              <div className="mt-3 max-h-64 space-y-1.5 overflow-y-auto rounded-2xl border border-border bg-surface p-1.5">
                {filtered.length === 0 && (
                  <p className="px-3 py-6 text-center text-sm text-muted">Eşleşen restoran yok.</p>
                )}
                {filtered.map((item) => (
                  <button
                    key={item.restaurantId}
                    type="button"
                    onClick={() => {
                      setEmail(item.email);
                      if (demoPassword) setPassword(demoPassword);
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                      email === item.email ? "bg-brand-soft" : "hover:bg-surface-2"
                    )}
                  >
                    <span className="text-xl">{item.emoji}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-ink">{item.name}</span>
                      <span className="block truncate text-xs text-muted">{item.email}</span>
                    </span>
                    {email === item.email && <span className="size-2.5 shrink-0 rounded-full bg-brand" />}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <Link
            href="/"
            className="mt-6 block text-center text-sm font-medium text-muted hover:text-ink lg:hidden"
          >
            ← Müşteri uygulamasına dön
          </Link>
        </form>
      </section>
    </div>
  );
}
