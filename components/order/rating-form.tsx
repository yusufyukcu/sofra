"use client";

import { ArrowLeft, CircleCheck, Hourglass, ReceiptText } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api-client";
import { useSession } from "@/lib/store/session";
import type { Order } from "@/lib/types";
import { cn, formatPrice } from "@/lib/utils";
import {
  Button,
  EmptyState,
  Field,
  Skeleton,
  StarPicker,
  Textarea,
} from "@/components/ui/primitives";
import { RestaurantThumb } from "@/components/ui/restaurant-thumb";
import { useToast } from "@/components/ui/toast";

/**
 * Sipariş değerlendirme: restoran ve kurye ayrı ayrı puanlanır.
 * Yorum bırakılırsa restoran sayfasındaki değerlendirmelere eklenir.
 */

const RESTAURANT_TAGS = [
  "Lezzetli",
  "Sıcak geldi",
  "Porsiyon bol",
  "Özenli paketleme",
  "Fiyat performans",
  "Hızlı hazırlandı",
];

const COURIER_TAGS = [
  "Nazik",
  "Hızlı",
  "Dikkatli taşıdı",
  "Tarife uydu",
  "Zamanında",
];

const SCORE_LABELS = ["", "Çok kötü", "Kötü", "İdare eder", "İyi", "Harika"];

export function RatingForm({ orderId }: { orderId: string }) {
  const router = useRouter();
  const toast = useToast();
  const user = useSession((s) => s.user);
  const setUser = useSession((s) => s.setUser);

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [restaurantScore, setRestaurantScore] = useState(5);
  const [restaurantTags, setRestaurantTags] = useState<string[]>([]);
  const [restaurantComment, setRestaurantComment] = useState("");

  const [courierScore, setCourierScore] = useState(5);
  const [courierTags, setCourierTags] = useState<string[]>([]);
  const [courierComment, setCourierComment] = useState("");
  const [tip, setTip] = useState(0);

  const [saving, setSaving] = useState(false);

  // Restoranın kendi kuryesiyle gelen siparişte platform kuryesi yok: kurye puanı ve bahşiş sorulmaz
  const realCourier = Boolean(order?.courier);

  useEffect(() => {
    api
      .get<{ order: Order }>(`/orders/${orderId}`)
      .then((data) => setOrder(data.order))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [orderId]);

  function toggle(list: string[], setList: (v: string[]) => void, tag: string) {
    setList(list.includes(tag) ? list.filter((t) => t !== tag) : [...list, tag]);
  }

  async function submit() {
    if (!order) return;
    setSaving(true);
    try {
      const composeComment = (comment: string, tags: string[]) =>
        [tags.join(", "), comment.trim()].filter(Boolean).join(". ") || undefined;

      const result = await api.post<{ walletBalance: number }>(`/orders/${orderId}/rating`, {
        restaurantScore,
        restaurantComment: composeComment(restaurantComment, restaurantTags),
        courierScore: realCourier ? courierScore : undefined,
        courierComment: realCourier
          ? composeComment(courierComment, courierTags)
          : undefined,
        courierTip: realCourier && tip > 0 ? tip : undefined,
      });

      if (user) setUser({ ...user, walletBalance: result.walletBalance });

      toast.success(
        tip > 0
          ? `Teşekkürler! ${formatPrice(tip)} bahşiş kuryene iletildi.`
          : "Değerlendirmen için teşekkürler!"
      );
      router.replace(`/siparis/${orderId}`);
    } catch (err) {
      toast.error(errorMessage(err));
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-4 pt-6 lg:px-6 lg:pt-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="mx-auto max-w-2xl px-4 pt-8 lg:px-6 lg:pt-12">
        <EmptyState
          icon={ReceiptText}
          title="Sipariş bulunamadı"
          description={error ?? undefined}
          action={
            <Link href="/hesabim/siparislerim">
              <Button>Siparişlerime dön</Button>
            </Link>
          }
        />
      </div>
    );
  }

  if (order.status !== "delivered") {
    return (
      <div className="mx-auto max-w-2xl px-4 pt-8 lg:px-6 lg:pt-12">
        <EmptyState
          icon={Hourglass}
          title="Sipariş henüz teslim edilmedi"
          description="Teslimat tamamlandığında bu sayfadan puan verebilirsin."
          action={
            <Link href={`/siparis/${orderId}`}>
              <Button>Siparişi takip et</Button>
            </Link>
          }
        />
      </div>
    );
  }

  if (order.rating) {
    return (
      <div className="mx-auto max-w-2xl px-4 pt-8 lg:px-6 lg:pt-12">
        <EmptyState
          icon={CircleCheck}
          title="Bu siparişi zaten değerlendirdin"
          description="Geri bildirimin için teşekkürler."
          action={
            <Link href={`/siparis/${orderId}`}>
              <Button>Sipariş detayına dön</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pt-6 lg:px-6 lg:pt-8">
      <Link
        href={`/siparis/${orderId}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-text"
      >
        <ArrowLeft className="size-4" />
        Sipariş detayı
      </Link>

      <h1 className="text-2xl font-extrabold tracking-tight">
        Siparişini değerlendir
      </h1>
      <p className="mt-1 text-sm text-muted">
        {order.code} · {order.restaurantName} ·{" "}
        {formatPrice(order.totals.grandTotal)}
      </p>

      {/* Restoran */}
      <section className="card mt-6 p-5">
        <div className="flex items-center gap-3">
          <RestaurantThumb
            image={order.restaurantImage}
            className="size-11 rounded-xl"
          />
          <div>
            <h2 className="font-extrabold text-text">{order.restaurantName}</h2>
            <p className="text-xs text-muted">Yemekler nasıldı?</p>
          </div>
        </div>

        <div className="mt-4 flex flex-col items-center gap-1.5">
          <StarPicker
            value={restaurantScore}
            onChange={setRestaurantScore}
            label="Restoran puanı"
          />
          <span className="text-sm font-semibold text-muted">
            {SCORE_LABELS[restaurantScore]}
          </span>
        </div>

        <TagPicker
          tags={RESTAURANT_TAGS}
          selected={restaurantTags}
          onToggle={(tag) => toggle(restaurantTags, setRestaurantTags, tag)}
        />

        <Field label="Yorumun (isteğe bağlı)" className="mt-4">
          <Textarea
            rows={3}
            value={restaurantComment}
            onChange={(e) => setRestaurantComment(e.target.value)}
            maxLength={400}
            placeholder="Deneyimini birkaç cümleyle anlat…"
          />
        </Field>
      </section>

      {/* Kurye */}
      {realCourier && order.courier && (
        <section className="card mt-4 p-5">
          <div className="flex items-center gap-3">
            <Avatar name={order.courier.name} className="size-11 text-sm" />
            <div>
              <h2 className="font-extrabold text-text">{order.courier.name}</h2>
              <p className="text-xs text-muted">Teslimat nasıldı?</p>
            </div>
          </div>

          <div className="mt-4 flex flex-col items-center gap-1.5">
            <StarPicker
              value={courierScore}
              onChange={setCourierScore}
              label="Kurye puanı"
            />
            <span className="text-sm font-semibold text-muted">
              {SCORE_LABELS[courierScore]}
            </span>
          </div>

          <TagPicker
            tags={COURIER_TAGS}
            selected={courierTags}
            onToggle={(tag) => toggle(courierTags, setCourierTags, tag)}
          />

          <Field label="Kurye hakkında notun (isteğe bağlı)" className="mt-4">
            <Textarea
              rows={2}
              value={courierComment}
              onChange={(e) => setCourierComment(e.target.value)}
              maxLength={300}
              placeholder="Teslimatla ilgili söylemek istediklerin…"
            />
          </Field>

          {/* Bahşiş — cüzdandan düşer, doğrudan kuryeye gider */}
          <div className="mt-5 border-t border-border pt-4">
            <p className="text-sm font-semibold text-ink">
              {order.courier.name.split(" ")[0]} için bahşiş
            </p>
            <p className="mt-0.5 text-xs text-muted">
              Tutar cüzdanından düşer ve tamamı kuryeye gider.
              {user && ` Bakiyen: ${formatPrice(user.walletBalance)}`}
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              {[0, 20, 30, 50, 75].map((amount) => {
                const disabled =
                  amount > 0 && user !== null && user.walletBalance < amount;
                return (
                  <button
                    key={amount}
                    type="button"
                    disabled={disabled}
                    onClick={() => setTip(amount)}
                    className={cn(
                      "tabular rounded-xl border px-3.5 py-2 text-sm font-bold transition-colors disabled:opacity-40",
                      tip === amount
                        ? "border-brand bg-brand text-brand-contrast"
                        : "border-border bg-surface text-ink hover:bg-surface-2"
                    )}
                  >
                    {amount === 0 ? "Bahşiş yok" : formatPrice(amount)}
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <div className="mt-5 flex gap-3">
        <Link href={`/siparis/${orderId}`} className="flex-1">
          <Button variant="secondary" block>
            Daha sonra
          </Button>
        </Link>
        <Button block size="lg" loading={saving} onClick={submit} className="flex-1">
          Değerlendirmeyi gönder
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function TagPicker({
  tags,
  selected,
  onToggle,
}: {
  tags: string[];
  selected: string[];
  onToggle: (tag: string) => void;
}) {
  return (
    <div className="mt-4 flex flex-wrap justify-center gap-2">
      {tags.map((tag) => (
        <button
          key={tag}
          type="button"
          onClick={() => onToggle(tag)}
          className={cn(
            "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
            selected.includes(tag)
              ? "border-brand bg-brand-soft text-brand"
              : "border-border bg-surface text-muted hover:bg-surface-2"
          )}
        >
          {tag}
        </button>
      ))}
    </div>
  );
}
