"use client";

import { Search, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api, errorMessage } from "@/lib/api-client";
import { useVendor } from "@/lib/store/vendor";
import type { Restaurant } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button, Field, Input, Skeleton } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";

interface PickerItem {
  id: string;
  name: string;
  emoji: string;
  district: string;
}

/**
 * İşletme girişi.
 *
 * Prototipte restoran listeden seçilir ve ortak bir PIN ile giriş yapılır.
 * Üretimde her işletmenin kendi e-posta + parolası ve iki adımlı doğrulaması
 * olur; bu ekranın yapısı aynı kalır.
 */
export function VendorLogin() {
  const router = useRouter();
  const toast = useToast();
  const status = useVendor((s) => s.status);
  const applyAuth = useVendor((s) => s.applyAuth);
  const bootstrap = useVendor((s) => s.bootstrap);

  const [items, setItems] = useState<PickerItem[] | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string>("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (status === "authenticated") router.replace("/isletme");
  }, [status, router]);

  useEffect(() => {
    api
      .get<{ restaurants: PickerItem[] }>("/vendor/auth/login")
      .then((data) => {
        setItems(data.restaurants);
        setSelected(data.restaurants[0]?.id ?? "");
      })
      .catch((err) => {
        toast.error(errorMessage(err));
        setItems([]);
      });
  }, [toast]);

  const filtered = useMemo(() => {
    if (!items) return [];
    const q = query.trim().toLocaleLowerCase("tr");
    if (!q) return items;
    return items.filter(
      (item) =>
        item.name.toLocaleLowerCase("tr").includes(q) ||
        item.district.toLocaleLowerCase("tr").includes(q)
    );
  }, [items, query]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const data = await api.post<{
        vendor: { id: string; name: string; email: string };
        restaurant: Restaurant;
      }>("/vendor/auth/login", { restaurantId: selected, pin });

      applyAuth({ vendor: data.vendor, restaurant: data.restaurant });
      toast.success(`${data.restaurant.name} paneline hoş geldin.`);
      router.replace("/isletme");
    } catch (err) {
      toast.error(errorMessage(err));
      setPin("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      {/* Tanıtım tarafı */}
      <section className="band-deep hidden flex-col justify-between p-10 lg:flex">
        <div className="flex items-center gap-2.5">
          <span className="flex size-10 items-center justify-center rounded-xl bg-brand text-xl">
            🍽️
          </span>
          <span className="font-display text-xl font-extrabold tracking-tight text-on-deep">
            Sofra İşletme
          </span>
        </div>

        <div className="max-w-md">
          <h1 className="font-display text-[2.5rem] font-extrabold leading-[1.05] text-on-deep">
            Mutfağın kontrol masası
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-on-deep-muted">
            Siparişleri anında gör ve onayla, menünü ve stoğunu tek ekrandan
            yönet, cironu ve hakedişlerini takip et.
          </p>

          <ul className="mt-9 space-y-3.5">
            {[
              ["🔔", "Yeni sipariş düştüğünde zil çalar"],
              ["⏱️", "Hazırlık süresini bildir, müşteri anında görsün"],
              ["🍽️", "Ürün ekle, fiyat güncelle, tükeneni kapat"],
              ["📊", "Günlük ciro, komisyon ve hakediş tabloları"],
            ].map(([emoji, text]) => (
              <li
                key={text}
                className="flex items-center gap-3 text-[15px] text-on-deep"
              >
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
          <h2 className="font-display text-2xl font-extrabold text-ink">
            İşletme girişi
          </h2>
          <p className="mt-1.5 text-sm text-muted">
            Restoranını seç ve panel PIN&apos;ini gir.
          </p>

          <label className="mt-6 flex h-11 items-center gap-2 rounded-xl border border-border bg-surface px-3 focus-within:border-brand">
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
            {!items && (
              <>
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </>
            )}
            {items && filtered.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-muted">
                Eşleşen restoran yok.
              </p>
            )}
            {filtered.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelected(item.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                  selected === item.id
                    ? "bg-brand-soft"
                    : "hover:bg-surface-2"
                )}
              >
                <span className="text-xl">{item.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-ink">
                    {item.name}
                  </span>
                  <span className="block text-xs text-muted">
                    {item.district}
                  </span>
                </span>
                {selected === item.id && (
                  <span className="size-2.5 shrink-0 rounded-full bg-brand" />
                )}
              </button>
            ))}
          </div>

          <Field label="Panel PIN" className="mt-5">
            <Input
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              placeholder="••••"
              autoComplete="off"
              className="text-center font-mono text-2xl tracking-[0.5em]"
            />
          </Field>

          <div className="mt-3 flex items-start gap-2 rounded-xl border border-info/25 bg-info-soft px-3.5 py-2.5 text-sm">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-info" />
            <span className="text-text">
              Prototip PIN&apos;i:{" "}
              <button
                type="button"
                onClick={() => setPin("1234")}
                className="font-mono font-extrabold text-info hover:underline"
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
            disabled={!selected || pin.length < 4}
          >
            Panele gir
          </Button>

          <Link
            href="/"
            className="mt-4 block text-center text-sm font-medium text-muted hover:text-ink lg:hidden"
          >
            ← Müşteri uygulamasına dön
          </Link>
        </form>
      </section>
    </div>
  );
}
