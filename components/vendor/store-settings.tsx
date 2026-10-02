"use client";

import { Clock, CreditCard, ImageIcon, MapPin, Store } from "lucide-react";
import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api-client";
import { PAYMENT_METHODS, PAYMENT_ORDER } from "@/lib/constants";
import { restaurantPhoto } from "@/lib/photos";
import { useVendor } from "@/lib/store/vendor";
import type { MediaRequest, PaymentMethodId, Restaurant } from "@/lib/types";
import { cn, formatPrice } from "@/lib/utils";
import { StaticMap } from "@/components/map";
import {
  Button,
  Field,
  Input,
  Skeleton,
  Switch,
  Textarea,
} from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { PhotoRequestField } from "./photo-request";

/**
 * Mağaza ayarları ve operasyon.
 *
 * Çalışma saatleri, mola, minimum sepet, teslimat bölgesi ve ödeme
 * yöntemleri buradan yönetilir. Kaydedilen her değişiklik müşteri
 * uygulamasına anında yansır. Kapak fotoğrafı ise kayıttan bağımsız
 * olarak yönetici onayına gider.
 */
export function StoreSettings() {
  const toast = useToast();
  const restaurant = useVendor((s) => s.restaurant);
  const setRestaurant = useVendor((s) => s.setRestaurant);

  const [draft, setDraft] = useState<Restaurant | null>(restaurant);
  const [hasBreak, setHasBreak] = useState(Boolean(restaurant?.breakHours));
  const [busy, setBusy] = useState(false);
  const [requests, setRequests] = useState<MediaRequest[]>([]);

  useEffect(() => {
    if (restaurant) {
      setDraft(restaurant);
      setHasBreak(Boolean(restaurant.breakHours));
    }
  }, [restaurant]);

  // Kapak yönetici onayıyla değişmiş olabilir: açılışta güncel hâli çek
  useEffect(() => {
    api
      .get<{ restaurant: Restaurant }>("/vendor/settings")
      .then((data) => setRestaurant(data.restaurant))
      .catch(() => undefined);
    api
      .get<{ requests: MediaRequest[] }>("/vendor/media")
      .then((data) => setRequests(data.requests))
      .catch(() => undefined);
  }, [setRestaurant]);

  if (!draft) return <Skeleton className="h-96 w-full" />;

  function patch(changes: Partial<Restaurant>) {
    setDraft((current) => (current ? { ...current, ...changes } : current));
  }

  function togglePayment(method: PaymentMethodId) {
    if (!draft) return;
    const has = draft.paymentMethods.includes(method);
    patch({
      paymentMethods: has
        ? draft.paymentMethods.filter((m) => m !== method)
        : [...draft.paymentMethods, method],
    });
  }

  async function save() {
    if (!draft) return;
    setBusy(true);
    try {
      const data = await api.patch<{ restaurant: Restaurant }>(
        "/vendor/settings",
        {
          description: draft.description,
          workingHours: draft.workingHours,
          breakHours: hasBreak
            ? (draft.breakHours ?? { start: "15:00", end: "16:00" })
            : null,
          minBasket: draft.minBasket,
          deliveryFee: draft.deliveryFee,
          freeDeliveryOver: draft.freeDeliveryOver,
          deliveryRadiusKm: draft.deliveryRadiusKm,
          etaMin: draft.etaMin,
          etaMax: draft.etaMax,
          temporarilyClosed: draft.temporarilyClosed,
          autoAccept: draft.autoAccept,
          paymentMethods: draft.paymentMethods,
        }
      );
      setRestaurant(data.restaurant);
      toast.success("Mağaza ayarları güncellendi.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-ink">
            Mağaza ayarları
          </h1>
          <p className="mt-0.5 text-sm text-muted">
            Değişiklikler kaydedildiği anda müşteri uygulamasına yansır.
          </p>
        </div>
        <Button size="lg" loading={busy} onClick={save}>
          Değişiklikleri kaydet
        </Button>
      </header>

      <div className="grid gap-5 xl:grid-cols-2">
        {/* Kapak fotoğrafı — kaydet düğmesinden bağımsız, onaya gider */}
        <Section
          icon={<ImageIcon className="size-5" />}
          title="Kapak fotoğrafı"
          className="xl:col-span-2"
        >
          <p className="-mt-2 mb-4 max-w-2xl text-sm text-muted">
            Restoran kartında ve restoran sayfasının üstünde görünür. Yeni
            fotoğraf yönetici onayından sonra yayına girer; bu bölüm
            &ldquo;Değişiklikleri kaydet&rdquo; düğmesini beklemez.
          </p>
          <div className="max-w-3xl">
            <PhotoRequestField
              target={{ kind: "cover" }}
              shape="cover"
              currentImage={restaurantPhoto(draft)}
              seed={draft.coverSeed}
              emoji={draft.emoji}
              tone={draft.tags[0]}
              requests={requests}
              onRequestsChange={setRequests}
            />
          </div>
        </Section>

        {/* Operasyon */}
        <Section icon={<Store className="size-5" />} title="Operasyon">
          <div className="space-y-2">
            <Switch
              checked={!draft.temporarilyClosed}
              onChange={(v) => patch({ temporarilyClosed: !v })}
              label="Siparişe açık"
              description="Yoğunlukta kapatırsan menün görünür ama sipariş alınmaz."
            />
            <Switch
              checked={draft.autoAccept}
              onChange={(v) => patch({ autoAccept: v })}
              label="Siparişleri otomatik onayla"
              description="Kapatırsan her sipariş panelden elle onaylanır ve zil çalar."
            />
          </div>

          <Field label="Restoran açıklaması" className="mt-4">
            <Textarea
              rows={3}
              value={draft.description}
              onChange={(e) => patch({ description: e.target.value })}
              maxLength={300}
            />
          </Field>
        </Section>

        {/* Çalışma saatleri */}
        <Section icon={<Clock className="size-5" />} title="Çalışma saatleri">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Açılış">
              <Input
                type="time"
                value={draft.workingHours.open}
                onChange={(e) =>
                  patch({
                    workingHours: {
                      ...draft.workingHours,
                      open: e.target.value,
                    },
                  })
                }
                className="tabular"
              />
            </Field>
            <Field label="Kapanış">
              <Input
                type="time"
                value={draft.workingHours.close}
                onChange={(e) =>
                  patch({
                    workingHours: {
                      ...draft.workingHours,
                      close: e.target.value,
                    },
                  })
                }
                className="tabular"
              />
            </Field>
          </div>

          <div className="mt-4">
            <Switch
              checked={hasBreak}
              onChange={setHasBreak}
              label="Gün ortası molası var"
              description="Mola saatlerinde sipariş alınmaz."
            />
            {hasBreak && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Field label="Mola başlangıcı">
                  <Input
                    type="time"
                    value={draft.breakHours?.start ?? "15:00"}
                    onChange={(e) =>
                      patch({
                        breakHours: {
                          start: e.target.value,
                          end: draft.breakHours?.end ?? "16:00",
                        },
                      })
                    }
                    className="tabular"
                  />
                </Field>
                <Field label="Mola bitişi">
                  <Input
                    type="time"
                    value={draft.breakHours?.end ?? "16:00"}
                    onChange={(e) =>
                      patch({
                        breakHours: {
                          start: draft.breakHours?.start ?? "15:00",
                          end: e.target.value,
                        },
                      })
                    }
                    className="tabular"
                  />
                </Field>
              </div>
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <Field label="En hızlı teslimat (dk)">
              <Input
                type="number"
                min={5}
                max={180}
                value={draft.etaMin}
                onChange={(e) => patch({ etaMin: Number(e.target.value) })}
                className="tabular"
              />
            </Field>
            <Field label="En geç teslimat (dk)">
              <Input
                type="number"
                min={5}
                max={180}
                value={draft.etaMax}
                onChange={(e) => patch({ etaMax: Number(e.target.value) })}
                className="tabular"
              />
            </Field>
          </div>
        </Section>

        {/* Teslimat bölgesi */}
        <Section icon={<MapPin className="size-5" />} title="Teslimat bölgesi">
          <div className="overflow-hidden rounded-2xl border border-border">
            <StaticMap
              point={draft.location}
              radiusKm={draft.deliveryRadiusKm}
              emoji={draft.emoji}
              className="h-56 w-full"
            />
          </div>

          <Field
            label={`Teslimat yarıçapı — ${draft.deliveryRadiusKm} km`}
            hint="Bu yarıçapın dışındaki adreslere sipariş verilemez."
            className="mt-4"
          >
            <input
              type="range"
              min={0.5}
              max={15}
              step={0.5}
              value={draft.deliveryRadiusKm}
              onChange={(e) =>
                patch({ deliveryRadiusKm: Number(e.target.value) })
              }
              className="w-full accent-[var(--brand)]"
            />
          </Field>

          <p className="mt-2 rounded-xl bg-surface-2 px-3 py-2.5 text-xs leading-relaxed text-muted">
            Bölge şimdilik merkez + yarıçap olarak tanımlanıyor. Poligon
            çizimi (mahalle bazlı özel bölgeler) sonraki sürümde bu ekrana
            eklenecek; sipariş kontrolü tek noktadan yapıldığı için müşteri
            tarafında değişiklik gerekmeyecek.
          </p>
        </Section>

        {/* Sepet ve ödeme */}
        <Section icon={<CreditCard className="size-5" />} title="Sepet ve ödeme">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Minimum sepet tutarı (₺)">
              <Input
                type="number"
                min={0}
                value={draft.minBasket}
                onChange={(e) => patch({ minBasket: Number(e.target.value) })}
                className="tabular"
              />
            </Field>
            <Field label="Teslimat ücreti (₺)">
              <Input
                type="number"
                min={0}
                step="0.1"
                value={draft.deliveryFee}
                onChange={(e) => patch({ deliveryFee: Number(e.target.value) })}
                className="tabular"
              />
            </Field>
          </div>

          <div className="mt-3">
            <Switch
              checked={draft.freeDeliveryOver !== null}
              onChange={(v) =>
                patch({ freeDeliveryOver: v ? 500 : null })
              }
              label="Belirli tutar üzeri ücretsiz teslimat"
              description="Sepet bu tutarı geçince teslimat ücreti alınmaz."
            />
            {draft.freeDeliveryOver !== null && (
              <Field label="Ücretsiz teslimat eşiği (₺)" className="mt-3">
                <Input
                  type="number"
                  min={0}
                  value={draft.freeDeliveryOver}
                  onChange={(e) =>
                    patch({ freeDeliveryOver: Number(e.target.value) })
                  }
                  className="tabular"
                />
              </Field>
            )}
          </div>

          <div className="mt-4">
            <p className="mb-2 text-sm font-semibold text-ink">
              Kabul edilen ödeme yöntemleri
            </p>
            <div className="space-y-1.5">
              {PAYMENT_ORDER.map((method) => {
                const active = draft.paymentMethods.includes(method);
                const info = PAYMENT_METHODS[method];
                return (
                  <button
                    key={method}
                    type="button"
                    onClick={() => togglePayment(method)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                      active
                        ? "border-brand bg-brand-soft"
                        : "border-border bg-surface hover:bg-surface-2"
                    )}
                  >
                    <span className="text-lg">{info.emoji}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-ink">
                        {info.name}
                      </span>
                      <span className="block text-xs text-muted">
                        {info.description}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "size-5 shrink-0 rounded-md border-2",
                        active ? "border-brand bg-brand" : "border-border-strong"
                      )}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          <p className="tabular mt-4 rounded-xl bg-surface-2 px-3 py-2.5 text-xs text-muted">
            Platform komisyon oranın{" "}
            <span className="font-bold text-ink">
              %{Math.round(draft.commissionRate * 100)}
            </span>
            . Örnek: {formatPrice(1000)} ciroda hakedişin{" "}
            {formatPrice(1000 * (1 - draft.commissionRate))}. Komisyon oranı
            platform yönetimi tarafından belirlenir.
          </p>
        </Section>
      </div>

      <div className="flex justify-end">
        <Button size="lg" loading={busy} onClick={save}>
          Değişiklikleri kaydet
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Section({
  icon,
  title,
  children,
  className,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("card p-5", className)}>
      <h2 className="font-display mb-4 flex items-center gap-2 text-base font-extrabold text-ink">
        <span className="text-brand">{icon}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}
