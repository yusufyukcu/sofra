"use client";

import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api-client";
import { useCourier, type PublicCourier } from "@/lib/store/courier";
import { cn } from "@/lib/utils";
import { Button, Field, Input, Skeleton } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";

interface PickerItem {
  id: string;
  name: string;
  emoji: string;
  vehicle: "moto" | "bisiklet" | "araba";
  rating: number;
  online: boolean;
}

const VEHICLE_LABEL = {
  moto: "Motosiklet",
  bisiklet: "Bisiklet",
  araba: "Araç",
} as const;

/**
 * Kurye girişi.
 *
 * Prototipte kurye listeden seçilir ve ortak PIN ile girilir. Üretimde
 * telefon + OTP ve kimlik doğrulama adımı olur; ekranın yapısı aynı kalır.
 */
export function CourierLogin() {
  const router = useRouter();
  const toast = useToast();
  const status = useCourier((s) => s.status);
  const applyAuth = useCourier((s) => s.applyAuth);
  const bootstrap = useCourier((s) => s.bootstrap);

  const [items, setItems] = useState<PickerItem[] | null>(null);
  const [selected, setSelected] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (status === "authenticated") router.replace("/kurye");
  }, [status, router]);

  useEffect(() => {
    api
      .get<{ couriers: PickerItem[] }>("/courier/auth/login")
      .then((data) => {
        setItems(data.couriers);
        setSelected(data.couriers[0]?.id ?? "");
      })
      .catch((err) => {
        toast.error(errorMessage(err));
        setItems([]);
      });
  }, [toast]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const data = await api.post<{ courier: PublicCourier }>(
        "/courier/auth/login",
        { courierId: selected, pin }
      );
      applyAuth(data.courier);
      toast.success(`Hoş geldin ${data.courier.name.split(" ")[0]}.`);
      router.replace("/kurye");
    } catch (err) {
      toast.error(errorMessage(err));
      setPin("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh justify-center bg-deep">
      <div className="flex min-h-dvh w-full max-w-md flex-col bg-paper shadow-float">
        <header className="band-deep px-5 pb-8 pt-10">
          <div className="flex items-center gap-2.5">
            <span className="flex size-10 items-center justify-center rounded-xl bg-brand text-xl">
              🛵
            </span>
            <span className="font-display text-xl font-extrabold tracking-tight text-on-deep">
              Sofra Kurye
            </span>
          </div>
          <h1 className="font-display mt-6 text-[1.8rem] font-extrabold leading-tight text-on-deep">
            Vardiyanı başlat,
            <br />
            kazanmaya başla
          </h1>
          <p className="mt-2.5 text-sm leading-relaxed text-on-deep-muted">
            Yakındaki siparişler sana gönderilir. Paket başı kazancını ve
            bahşişlerini anlık takip edersin.
          </p>
        </header>

        <form onSubmit={submit} className="flex-1 px-5 py-6">
          <p className="mb-3 text-sm font-semibold text-ink">Hesabını seç</p>

          <div className="space-y-2">
            {!items && (
              <>
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </>
            )}
            {items?.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelected(item.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors",
                  selected === item.id
                    ? "border-brand bg-brand-soft"
                    : "border-border bg-surface hover:bg-surface-2"
                )}
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xl">
                  {item.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-bold text-ink">
                    {item.name}
                  </span>
                  <span className="tabular block text-xs text-muted">
                    ⭐ {item.rating.toFixed(1)} · {VEHICLE_LABEL[item.vehicle]}
                    {item.online && (
                      <span className="ml-1.5 font-semibold text-pistachio">
                        · mesaide
                      </span>
                    )}
                  </span>
                </span>
                {selected === item.id && (
                  <span className="size-2.5 shrink-0 rounded-full bg-brand" />
                )}
              </button>
            ))}
          </div>

          <Field label="PIN" className="mt-5">
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
            className="mt-5 h-14"
            loading={busy}
            disabled={!selected || pin.length < 4}
          >
            Uygulamaya gir
          </Button>

          <Link
            href="/"
            className="mt-5 block text-center text-sm font-medium text-muted hover:text-ink"
          >
            ← Müşteri uygulamasına dön
          </Link>
        </form>
      </div>
    </div>
  );
}
