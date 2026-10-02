"use client";

import {
  ArrowLeft,
  BellOff,
  Check,
  CreditCard,
  MapPin,
  Package,
  Tag,
  Utensils,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, errorMessage } from "@/lib/api-client";
import {
  ADDRESS_LABELS,
  MEAL_CARD_BRANDS,
  PAYMENT_METHODS,
  PAYMENT_ORDER,
} from "@/lib/constants";
import { useDebounced } from "@/lib/hooks";
import { useCart } from "@/lib/store/cart";
import { selectedAddress, useSession } from "@/lib/store/session";
import type {
  Coupon,
  MealCardBrand,
  Order,
  OrderTotals,
  PaymentMethodId,
  Restaurant,
} from "@/lib/types";
import { cn, formatPrice } from "@/lib/utils";
import { AddressForm } from "@/components/account/address-form";
import { Modal } from "@/components/ui/modal";
import { RestaurantThumb } from "@/components/ui/restaurant-thumb";
import {
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  Skeleton,
  Switch,
  Textarea,
} from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";

/**
 * Ödeme (checkout) ekranı.
 *
 * Tutarlar her değişiklikte sunucudan alınır (`/coupons/validate`): indirim,
 * teslimat ücreti ve hizmet bedeli hesabı tek bir yerde — sunucuda — yapılır.
 * İstemci yalnızca gösterir.
 */
export function CheckoutClient() {
  const router = useRouter();
  const toast = useToast();

  const status = useSession((s) => s.status);
  const user = useSession((s) => s.user);
  const address = useSession(selectedAddress);
  const addresses = useSession((s) => s.addresses);
  const selectAddress = useSession((s) => s.selectAddress);
  const cards = useSession((s) => s.cards);
  const refreshActiveOrders = useSession((s) => s.refreshActiveOrders);

  const cartRestaurant = useCart((s) => s.restaurant);
  const lines = useCart((s) => s.lines);
  const clearCart = useCart((s) => s.clear);

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [totals, setTotals] = useState<OrderTotals | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [availableCoupons, setAvailableCoupons] = useState<Coupon[]>([]);

  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [payment, setPayment] = useState<PaymentMethodId>("online_card");
  const [mealCardBrand, setMealCardBrand] = useState<MealCardBrand>("multinet");
  const [cardId, setCardId] = useState<string>("");

  const [contactless, setContactless] = useState(false);
  const [ringDoorbell, setRingDoorbell] = useState(true);
  const [cutlery, setCutlery] = useState(true);
  const [note, setNote] = useState("");

  const [addressModal, setAddressModal] = useState(false);
  const [addingAddress, setAddingAddress] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const debouncedCode = useDebounced(code, 400);

  /* ---------------------------------------------------------------- */
  /* Korumalar                                                        */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    if (status === "guest") router.replace("/giris?devam=/odeme" as never);
  }, [status, router]);

  useEffect(() => {
    if (!lines.length) router.replace("/sepet");
  }, [lines.length, router]);

  /* ---------------------------------------------------------------- */
  /* Restoran & kupon verileri                                        */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    if (!cartRestaurant) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await api.get<{ restaurant: Restaurant }>(
          `/restaurants/${cartRestaurant.slug}`
        );
        if (cancelled) return;
        setRestaurant(data.restaurant);
        setPayment((current) =>
          data.restaurant.paymentMethods.includes(current)
            ? current
            : data.restaurant.paymentMethods[0]
        );
      } catch (err) {
        if (!cancelled) toast.error(errorMessage(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cartRestaurant, toast]);

  useEffect(() => {
    if (status !== "authenticated") return;
    api
      .get<{ coupons: Coupon[] }>("/coupons")
      .then((data) => setAvailableCoupons(data.coupons))
      .catch(() => undefined);
  }, [status]);

  useEffect(() => {
    if (cards.length && !cardId) setCardId(cards[0].id);
  }, [cards, cardId]);

  /* ---------------------------------------------------------------- */
  /* Tutarların sunucudan hesaplanması                                */
  /* ---------------------------------------------------------------- */

  const refreshTotals = useCallback(async () => {
    if (!cartRestaurant || !lines.length || status !== "authenticated") return;
    try {
      const data = await api.post<{
        totals: OrderTotals;
        coupon: Coupon | null;
      }>("/coupons/validate", {
        restaurantId: cartRestaurant.id,
        lines,
        code: debouncedCode.trim() || undefined,
        paymentMethod: payment,
      });
      setTotals(data.totals);
      setAppliedCoupon(data.coupon);
      setCodeError("");
    } catch (err) {
      // Kupon hatalıysa kupon olmadan tekrar dene ki tutarlar görünmeye devam etsin
      if (debouncedCode.trim()) {
        setCodeError(errorMessage(err));
        setAppliedCoupon(null);
        try {
          const fallback = await api.post<{ totals: OrderTotals }>(
            "/coupons/validate",
            {
              restaurantId: cartRestaurant.id,
              lines,
              paymentMethod: payment,
            }
          );
          setTotals(fallback.totals);
        } catch {
          /* yoksay */
        }
      } else {
        toast.error(errorMessage(err));
      }
    }
  }, [cartRestaurant, lines, debouncedCode, payment, status, toast]);

  useEffect(() => {
    void refreshTotals();
  }, [refreshTotals]);

  /* ---------------------------------------------------------------- */
  /* Sipariş oluşturma                                                */
  /* ---------------------------------------------------------------- */

  async function submit() {
    if (!cartRestaurant || !address) return;
    setSubmitting(true);
    try {
      const data = await api.post<{ order: Order }>("/orders", {
        restaurantId: cartRestaurant.id,
        addressId: address.id,
        lines,
        couponCode: appliedCoupon?.code,
        paymentMethod: payment,
        mealCardBrand: payment === "meal_card" ? mealCardBrand : undefined,
        cardId: payment === "online_card" ? cardId : undefined,
        preferences: { contactless, ringDoorbell, cutlery, note },
      });

      clearCart();
      void refreshActiveOrders();
      toast.success("Siparişin alındı! 🎉");
      router.replace(`/siparis/${data.order.id}`);
    } catch (err) {
      toast.error(errorMessage(err));
      setSubmitting(false);
    }
  }

  /* ---------------------------------------------------------------- */

  const availablePayments = useMemo(
    () =>
      PAYMENT_ORDER.filter((id) =>
        restaurant ? restaurant.paymentMethods.includes(id) : true
      ),
    [restaurant]
  );

  const walletShort =
    payment === "wallet" &&
    totals &&
    user &&
    user.walletBalance < totals.grandTotal;

  const belowMin =
    restaurant && totals ? totals.subtotal < restaurant.minBasket : false;

  if (status === "loading" || (!restaurant && lines.length)) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 px-4 pt-6 lg:px-6 lg:pt-8">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8">
          <div className="space-y-4">
            <Skeleton className="h-36 w-full" />
            <Skeleton className="h-52 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
          <Skeleton className="h-80 w-full" />
        </div>
      </div>
    );
  }

  if (!lines.length || !cartRestaurant) return null;

  return (
    <div className="mx-auto max-w-5xl px-4 pt-6 lg:px-6 lg:pt-8">
      <Link
        href="/sepet"
        className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-text"
      >
        <ArrowLeft className="size-4" />
        Sepete dön
      </Link>

      <h1 className="mb-6 text-2xl font-extrabold tracking-tight sm:text-3xl">
        Siparişi tamamla
      </h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8">
        <div className="min-w-0 space-y-4">
          {/* Adres */}
          <Section icon={<MapPin className="size-5" />} title="Teslimat adresi">
            {address ? (
              <div className="flex items-start gap-3">
                <span className="text-xl" aria-hidden>
                  {ADDRESS_LABELS.find((l) => l.id === address.label)?.emoji ?? "📍"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-text">{address.title}</p>
                  <p className="mt-0.5 text-sm text-muted">{address.line1}</p>
                  <p className="text-sm text-muted">
                    {[address.buildingNo && `No: ${address.buildingNo}`, address.floor && `Kat: ${address.floor}`, address.apartmentNo && `Daire: ${address.apartmentNo}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <p className="text-xs text-muted">
                    {address.district} / {address.city}
                  </p>
                  {address.directions && (
                    <p className="mt-1.5 rounded-lg bg-surface-2 px-2.5 py-1.5 text-xs italic text-muted">
                      {address.directions}
                    </p>
                  )}
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setAddressModal(true)}
                >
                  Değiştir
                </Button>
              </div>
            ) : (
              <EmptyState
                emoji="📍"
                title="Kayıtlı adresin yok"
                description="Siparişini teslim edebilmemiz için bir adres eklemelisin."
                action={
                  <Button onClick={() => { setAddingAddress(true); setAddressModal(true); }}>
                    Adres ekle
                  </Button>
                }
              />
            )}
          </Section>

          {/* Teslimat tercihleri */}
          <Section
            icon={<Package className="size-5" />}
            title="Teslimat tercihleri"
          >
            <div className="space-y-2">
              <Switch
                checked={contactless}
                onChange={setContactless}
                label="Temassız teslimat"
                description="Kurye paketi kapıya bırakır, yüz yüze temas olmaz."
                icon={<Package className="size-5" />}
              />
              <Switch
                checked={ringDoorbell}
                onChange={setRingDoorbell}
                label="Zile bassın"
                description="Kapalıysa kurye seni arayarak haber verir."
                icon={<BellOff className="size-5" />}
              />
              <Switch
                checked={cutlery}
                onChange={setCutlery}
                label="Çatal, bıçak ve peçete gelsin"
                description="İstemezsen gereksiz plastik kullanılmaz."
                icon={<Utensils className="size-5" />}
              />
            </div>

            <Field
              label="Kurye notu"
              hint="Adres tarifi, kapı kodu veya özel bir istek."
              className="mt-4"
            >
              <Textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={300}
                placeholder="Örn: Site girişinde güvenliğe bırakabilirsiniz."
              />
            </Field>
          </Section>

          {/* Ödeme */}
          <Section icon={<CreditCard className="size-5" />} title="Ödeme yöntemi">
            <div className="space-y-2">
              {availablePayments.map((id) => {
                const method = PAYMENT_METHODS[id];
                const active = payment === id;
                const insufficient =
                  id === "wallet" &&
                  totals !== null &&
                  user !== null &&
                  user.walletBalance < totals.grandTotal;

                return (
                  <div key={id}>
                    <button
                      type="button"
                      onClick={() => setPayment(id)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition-colors",
                        active
                          ? "border-brand bg-brand-soft"
                          : "border-border bg-surface hover:bg-surface-2"
                      )}
                    >
                      <span className="text-xl" aria-hidden>
                        {method.emoji}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-text">
                            {method.name}
                          </span>
                          {id === "wallet" && user && (
                            <Badge tone={insufficient ? "danger" : "success"}>
                              {formatPrice(user.walletBalance)}
                            </Badge>
                          )}
                          {method.onDelivery && <Badge>Kapıda</Badge>}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted">
                          {insufficient
                            ? "Bakiyen bu sipariş için yeterli değil."
                            : method.description}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "flex size-5 shrink-0 items-center justify-center rounded-full border-2",
                          active
                            ? "border-brand bg-brand text-brand-contrast"
                            : "border-border-strong"
                        )}
                      >
                        {active && <span className="size-2 rounded-full bg-current" />}
                      </span>
                    </button>

                    {/* Alt seçimler */}
                    {active && id === "online_card" && cards.length > 0 && (
                      <div className="mt-2 space-y-1.5 pl-4">
                        {cards.map((card) => (
                          <button
                            key={card.id}
                            type="button"
                            onClick={() => setCardId(card.id)}
                            className={cn(
                              "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                              cardId === card.id
                                ? "border-brand bg-surface"
                                : "border-border bg-surface-2"
                            )}
                          >
                            <span className="font-mono text-xs uppercase text-muted">
                              {card.brand}
                            </span>
                            <span className="font-semibold text-text">
                              •••• {card.last4}
                            </span>
                            <span className="text-xs text-muted">
                              {card.nickname}
                            </span>
                            {cardId === card.id && (
                              <Check className="ml-auto size-4 text-brand" />
                            )}
                          </button>
                        ))}
                        <p className="pt-1 text-xs text-muted">
                          Prototipte ödeme geçidi simüle edilir; gerçek tahsilat yapılmaz.
                        </p>
                      </div>
                    )}

                    {active && id === "meal_card" && (
                      <div className="mt-2 flex flex-wrap gap-2 pl-4">
                        {MEAL_CARD_BRANDS.map((brand) => (
                          <button
                            key={brand.id}
                            type="button"
                            onClick={() => setMealCardBrand(brand.id)}
                            className={cn(
                              "rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors",
                              mealCardBrand === brand.id
                                ? "border-brand bg-brand text-brand-contrast"
                                : "border-border bg-surface text-text hover:bg-surface-2"
                            )}
                          >
                            {brand.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Section>

          {/* Promosyon kodu */}
          <Section icon={<Tag className="size-5" />} title="Promosyon kodu">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="Kodu gir (ör. SOFRA10)"
                  className="uppercase"
                  maxLength={24}
                />
                {codeError && (
                  <p className="mt-1.5 text-xs font-medium text-danger">
                    {codeError}
                  </p>
                )}
                {appliedCoupon && (
                  <p className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-success">
                    <Check className="size-3.5" />
                    {appliedCoupon.title} uygulandı
                  </p>
                )}
              </div>
              {code && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setCode("");
                    setCodeError("");
                  }}
                  aria-label="Kodu temizle"
                >
                  <X className="size-4" />
                </Button>
              )}
            </div>

            {availableCoupons.length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Kullanabileceğin kampanyalar
                </p>
                {availableCoupons.slice(0, 4).map((coupon) => (
                  <button
                    key={coupon.code}
                    type="button"
                    onClick={() => setCode(coupon.code)}
                    className="flex w-full items-center gap-3 rounded-xl border border-dashed border-border-strong p-3 text-left transition-colors hover:border-brand hover:bg-brand-soft"
                  >
                    <span className="rounded-lg bg-surface-2 px-2 py-1 font-mono text-xs font-bold text-brand">
                      {coupon.code}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-text">
                        {coupon.title}
                      </span>
                      <span className="block text-xs text-muted">
                        {coupon.description}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </Section>
        </div>

        {/* Özet */}
        <aside>
          <div className="card sticky top-24 p-5 sm:p-6">
            <div className="flex items-center gap-2.5 border-b border-border pb-3">
              <RestaurantThumb
                image={cartRestaurant.image}
                emoji={cartRestaurant.emoji}
                className="size-10 rounded-xl"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-text">
                  {cartRestaurant.name}
                </p>
                <p className="text-xs text-muted">
                  {lines.reduce((s, l) => s + l.quantity, 0)} ürün
                </p>
              </div>
            </div>

            <ul className="max-h-48 space-y-2 overflow-y-auto py-3 text-sm">
              {lines.map((line) => (
                <li key={line.lineId} className="flex justify-between gap-2">
                  <span className="min-w-0 text-muted">
                    <span className="font-semibold text-text">
                      {line.quantity}×
                    </span>{" "}
                    {line.name}
                  </span>
                  <span className="shrink-0 font-semibold text-text">
                    {formatPrice(line.unitPrice * line.quantity)}
                  </span>
                </li>
              ))}
            </ul>

            {totals ? (
              <dl className="space-y-2 border-t border-border pt-3 text-sm">
                <Row label="Ara toplam" value={formatPrice(totals.subtotal)} />
                {totals.discount > 0 && (
                  <Row
                    label="İndirim"
                    value={`− ${formatPrice(totals.discount)}`}
                    tone="success"
                  />
                )}
                <Row
                  label="Teslimat ücreti"
                  value={
                    totals.deliveryFee === 0
                      ? "Ücretsiz"
                      : formatPrice(totals.deliveryFee)
                  }
                  tone={totals.deliveryFee === 0 ? "success" : undefined}
                />
                <Row
                  label="Hizmet bedeli"
                  value={formatPrice(totals.serviceFee)}
                />
                <div className="flex items-baseline justify-between border-t border-border pt-3">
                  <span className="font-bold text-text">Ödenecek tutar</span>
                  <span className="text-xl font-extrabold text-text">
                    {formatPrice(totals.grandTotal)}
                  </span>
                </div>
              </dl>
            ) : (
              <Skeleton className="mt-3 h-32 w-full" />
            )}

            {belowMin && restaurant && (
              <p className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-xs font-semibold text-danger">
                Minimum sepet tutarı {formatPrice(restaurant.minBasket)}.
              </p>
            )}

            <Button
              block
              size="lg"
              className="mt-4"
              loading={submitting}
              disabled={!address || !totals || Boolean(walletShort) || belowMin}
              onClick={submit}
            >
              {totals
                ? `${formatPrice(totals.grandTotal)} · Siparişi onayla`
                : "Hesaplanıyor…"}
            </Button>

            <p className="mt-2.5 text-center text-[11px] leading-relaxed text-muted">
              Siparişi onaylayarak mesafeli satış sözleşmesini kabul etmiş
              olursun. Bu bir prototiptir; gerçek ödeme alınmaz.
            </p>
          </div>
        </aside>
      </div>

      {/* Adres seçim / ekleme */}
      <Modal
        open={addressModal}
        onClose={() => {
          setAddressModal(false);
          setAddingAddress(false);
        }}
        title={addingAddress ? "Yeni adres" : "Teslimat adresi seç"}
        size={addingAddress ? "lg" : "md"}
      >
        {addingAddress ? (
          <AddressForm
            onSaved={(saved) => {
              selectAddress(saved.id);
              setAddingAddress(false);
              setAddressModal(false);
            }}
            onCancel={() => setAddingAddress(false)}
          />
        ) : (
          <div className="space-y-2">
            {addresses.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  selectAddress(item.id);
                  setAddressModal(false);
                }}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition-colors",
                  item.id === address?.id
                    ? "border-brand bg-brand-soft"
                    : "border-border hover:bg-surface-2"
                )}
              >
                <span className="text-xl">
                  {ADDRESS_LABELS.find((l) => l.id === item.label)?.emoji ?? "📍"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-text">
                    {item.title}
                  </span>
                  <span className="mt-0.5 block truncate text-sm text-muted">
                    {item.line1}
                  </span>
                </span>
              </button>
            ))}
            <Button variant="secondary" block onClick={() => setAddingAddress(true)}>
              Yeni adres ekle
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card p-5 sm:p-6">
      <h2 className="mb-4 flex items-center gap-2 text-base font-extrabold text-text">
        <span className="text-brand">{icon}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success";
}) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted">{label}</dt>
      <dd
        className={cn(
          "font-semibold",
          tone === "success" ? "text-success" : "text-text"
        )}
      >
        {value}
      </dd>
    </div>
  );
}
