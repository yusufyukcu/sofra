"use client";

import { CheckCircle2, KeyRound, Link2Off } from "lucide-react";
import { LogoTile } from "@/components/brand/logo";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api-client";
import { useVendor } from "@/lib/store/vendor";
import type { Restaurant } from "@/lib/types";
import { Button, EmptyState, Field, Input, Skeleton } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";

/**
 * Onaylanan işletmenin panel kurulumu: tek kullanımlık bağlantıyla gelir,
 * parolasını belirler ve doğrudan panele girer.
 */
export function VendorSetup({ token }: { token: string }) {
  const router = useRouter();
  const toast = useToast();
  const applyAuth = useVendor((s) => s.applyAuth);

  const [info, setInfo] = useState<{ email: string; restaurantName: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Kurulum bağlantısı eksik.");
      return;
    }
    api
      .get<{ email: string; restaurantName: string }>(`/vendor/auth/setup?anahtar=${encodeURIComponent(token)}`)
      .then(setInfo)
      .catch((err) => setError(errorMessage(err)));
  }, [token]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (password !== repeat) {
      toast.error("Parolalar eşleşmiyor.");
      return;
    }
    setBusy(true);
    try {
      const data = await api.post<{
        vendor: { id: string; name: string; email: string };
        restaurant: Restaurant;
      }>("/vendor/auth/setup", { token, password });
      applyAuth({ vendor: data.vendor, restaurant: data.restaurant });
      toast.success("Parolan kaydedildi. Paneline hoş geldin!");
      router.replace("/isletme");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-paper p-5">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-2.5">
          <LogoTile />
          <span className="font-display text-xl font-extrabold tracking-tight text-ink">Sofra İşletme</span>
        </div>

        {error ? (
          <EmptyState
            icon={Link2Off}
            title="Bağlantı kullanılamıyor"
            description={error}
            action={
              <Link href="/isletme/giris">
                <Button variant="secondary">İşletme girişine git</Button>
              </Link>
            }
          />
        ) : !info ? (
          <Skeleton className="h-72 w-full" />
        ) : (
          <form onSubmit={submit} className="card p-6">
            <span className="flex size-11 items-center justify-center rounded-xl bg-success-soft text-success">
              <CheckCircle2 className="size-5" />
            </span>
            <h1 className="font-display mt-4 text-2xl font-extrabold text-ink">Başvurun onaylandı</h1>
            <p className="mt-1.5 text-sm text-muted">
              <span className="font-semibold text-ink">{info.restaurantName}</span> paneli için bir parola belirle.
              Giriş e-postan: <span className="font-semibold text-ink">{info.email}</span>
            </p>

            <Field label="Parola" hint="En az 8 karakter." className="mt-5">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </Field>
            <Field label="Parola (tekrar)" className="mt-4">
              <Input
                type="password"
                value={repeat}
                onChange={(e) => setRepeat(e.target.value)}
                autoComplete="new-password"
              />
            </Field>

            <Button type="submit" block size="lg" className="mt-5" loading={busy} disabled={password.length < 8}>
              <KeyRound className="size-4" />
              Parolayı kaydet ve panele gir
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
