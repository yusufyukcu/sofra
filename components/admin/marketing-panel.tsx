"use client";

import {
  ChevronDown,
  ChevronUp,
  Pencil,
  Plus,
  Send,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api-client";
import { useDebounced } from "@/lib/hooks";
import type { Banner, Coupon, PushCampaign } from "@/lib/types";
import { cn, formatPrice, relativeTime } from "@/lib/utils";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
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

type Tab = "coupons" | "banners" | "push";

interface Snapshot {
  coupons: Coupon[];
  banners: Banner[];
  campaigns: PushCampaign[];
  districts: string[];
  restaurants: { id: string; name: string; emoji: string }[];
  audienceCount?: number;
  sent?: PushCampaign;
}

const SEGMENTS: { id: PushCampaign["segment"]; label: string; hint: string }[] = [
  { id: "all", label: "Tüm kullanıcılar", hint: "Kara listedekiler hariç" },
  { id: "active", label: "Aktif", hint: "Son 30 günde sipariş verenler" },
  { id: "lapsed", label: "Uzaklaşan", hint: "30 gündür sipariş vermeyenler" },
  { id: "new", label: "Yeni", hint: "Henüz sipariş vermemiş olanlar" },
];

const GRADIENTS: [string, string][] = [
  ["#C4351E", "#DF9411"],
  ["#2E5F3A", "#6FA34A"],
  ["#3E2029", "#9E2A4A"],
  ["#8A2246", "#D4538A"],
  ["#2F5A3E", "#8FBF5E"],
  ["#1F4E79", "#4E8FE2"],
];

/**
 * Pazarlama ve kampanya yönetimi.
 *
 * Üç araç: global promosyon kodları, uygulama içi vitrin afişleri ve
 * bölge/segment bazlı push bildirimi. Kaydedilen her değişiklik müşteri
 * uygulamasına anında yansır.
 */
export function MarketingPanel() {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("coupons");
  const [data, setData] = useState<Snapshot | null>(null);

  const [couponFor, setCouponFor] = useState<Coupon | "new" | null>(null);
  const [bannerFor, setBannerFor] = useState<Banner | "new" | null>(null);
  const [deleting, setDeleting] = useState<
    { kind: "coupon" | "banner"; id: string; name: string } | null
  >(null);

  useEffect(() => {
    api
      .get<Snapshot>("/admin/marketing")
      .then(setData)
      .catch((err) => toast.error(errorMessage(err)));
  }, [toast]);

  async function act(body: Record<string, unknown>, message?: string) {
    try {
      const result = await api.post<Snapshot>("/admin/marketing", body);
      setData(result);
      if (message) toast.success(message);
      return result;
    } catch (err) {
      toast.error(errorMessage(err));
      return null;
    }
  }

  if (!data) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-ink">
            Pazarlama
          </h1>
          <p className="mt-0.5 text-sm text-muted">
            Kampanya kodları, vitrin afişleri ve push bildirimleri.
          </p>
        </div>

        {tab === "coupons" && (
          <Button onClick={() => setCouponFor("new")}>
            <Plus className="size-4" />
            Kampanya oluştur
          </Button>
        )}
        {tab === "banners" && (
          <Button onClick={() => setBannerFor("new")}>
            <Plus className="size-4" />
            Afiş ekle
          </Button>
        )}
      </header>

      <div className="flex gap-1 rounded-xl bg-surface-2 p-1">
        {(
          [
            ["coupons", `Kampanya kodları (${data.coupons.length})`],
            ["banners", `Vitrin afişleri (${data.banners.length})`],
            ["push", "Push bildirimi"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "flex-1 rounded-lg py-2 text-sm font-semibold transition-colors",
              tab === id
                ? "bg-surface text-ink shadow-sm"
                : "text-muted hover:text-ink"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Kampanya kodları */}
      {tab === "coupons" &&
        (data.coupons.length === 0 ? (
          <EmptyState
            emoji="🎟️"
            title="Henüz kampanya yok"
            description="İlk promosyon kodunu oluştur."
            action={
              <Button onClick={() => setCouponFor("new")}>
                Kampanya oluştur
              </Button>
            }
          />
        ) : (
          <ul className="space-y-2.5">
            {data.coupons.map((coupon) => {
              const expired = new Date(coupon.expiresAt).getTime() < Date.now();
              return (
                <li
                  key={coupon.code}
                  className={cn(
                    "card flex flex-wrap items-center gap-3 p-4",
                    (!coupon.active || expired) && "opacity-70"
                  )}
                >
                  <span className="font-display shrink-0 rounded-lg bg-brand-soft px-2.5 py-1.5 font-mono text-sm font-extrabold text-brand">
                    {coupon.code}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-[15px] font-bold text-ink">
                        {coupon.title}
                      </span>
                      {!coupon.active && <Badge>Yayında değil</Badge>}
                      {expired && <Badge tone="danger">Süresi doldu</Badge>}
                      {coupon.firstOrderOnly && (
                        <Badge tone="accent">İlk siparişe özel</Badge>
                      )}
                      {coupon.restaurantIds && (
                        <Badge tone="info">
                          {coupon.restaurantIds.length} restoran
                        </Badge>
                      )}
                    </p>
                    <p className="tabular truncate text-xs text-muted">
                      {coupon.type === "percent"
                        ? `%${coupon.value}`
                        : coupon.type === "free_delivery"
                          ? "Ücretsiz teslimat"
                          : formatPrice(coupon.value)}
                      {" · "}min {formatPrice(coupon.minSubtotal)}
                      {coupon.maxDiscount
                        ? ` · en fazla ${formatPrice(coupon.maxDiscount)}`
                        : ""}
                      {" · bitiş "}
                      {new Date(coupon.expiresAt).toLocaleDateString("tr-TR")}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        act(
                          { action: "coupon-toggle", code: coupon.code },
                          coupon.active
                            ? `${coupon.code} yayından kaldırıldı.`
                            : `${coupon.code} yayına alındı.`
                        )
                      }
                      className={cn(
                        "rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors",
                        coupon.active
                          ? "bg-pistachio-soft text-pistachio"
                          : "bg-surface-2 text-muted hover:text-ink"
                      )}
                    >
                      {coupon.active ? "Yayında" : "Kapalı"}
                    </button>
                    <IconButton
                      label="Düzenle"
                      onClick={() => setCouponFor(coupon)}
                    >
                      <Pencil className="size-4" />
                    </IconButton>
                    <IconButton
                      label="Sil"
                      danger
                      onClick={() =>
                        setDeleting({
                          kind: "coupon",
                          id: coupon.code,
                          name: coupon.code,
                        })
                      }
                    >
                      <Trash2 className="size-4" />
                    </IconButton>
                  </div>
                </li>
              );
            })}
          </ul>
        ))}

      {/* Vitrin afişleri */}
      {tab === "banners" && (
        <div className="space-y-2.5">
          <p className="text-sm text-muted">
            Afişler anasayfa vitrininde bu sırayla döner.
          </p>
          {data.banners.map((banner, index) => (
            <div
              key={banner.id}
              className={cn(
                "card flex flex-wrap items-center gap-3 p-3",
                !banner.active && "opacity-60"
              )}
            >
              <span
                className="flex size-14 shrink-0 items-center justify-center rounded-xl text-2xl"
                style={{
                  backgroundImage: `linear-gradient(120deg, ${banner.gradient[0]}, ${banner.gradient[1]})`,
                }}
              >
                {banner.emoji}
              </span>

              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-1.5">
                  <span className="truncate text-[15px] font-bold text-ink">
                    {banner.title}
                  </span>
                  {banner.code && (
                    <Badge tone="brand">
                      <span className="font-mono">{banner.code}</span>
                    </Badge>
                  )}
                  {!banner.active && <Badge>Gizli</Badge>}
                </p>
                <p className="truncate text-xs text-muted">
                  {banner.subtitle} · {banner.href}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <IconButton
                  label="Yukarı taşı"
                  disabled={index === 0}
                  onClick={() =>
                    act({ action: "banner-move", id: banner.id, direction: "up" })
                  }
                >
                  <ChevronUp className="size-4" />
                </IconButton>
                <IconButton
                  label="Aşağı taşı"
                  disabled={index === data.banners.length - 1}
                  onClick={() =>
                    act({
                      action: "banner-move",
                      id: banner.id,
                      direction: "down",
                    })
                  }
                >
                  <ChevronDown className="size-4" />
                </IconButton>
                <IconButton label="Düzenle" onClick={() => setBannerFor(banner)}>
                  <Pencil className="size-4" />
                </IconButton>
                <IconButton
                  label="Sil"
                  danger
                  onClick={() =>
                    setDeleting({
                      kind: "banner",
                      id: banner.id,
                      name: banner.title,
                    })
                  }
                >
                  <Trash2 className="size-4" />
                </IconButton>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Push */}
      {tab === "push" && (
        <PushComposer
          districts={data.districts}
          campaigns={data.campaigns}
          onSend={async (push) => {
            const result = await act({ action: "push-send", push });
            if (result?.sent) {
              toast.success(
                `Bildirim ${result.sent.recipientCount} kişiye gönderildi.`
              );
            }
          }}
        />
      )}

      {/* Kampanya formu */}
      {couponFor && (
        <CouponModal
          coupon={couponFor === "new" ? null : couponFor}
          restaurants={data.restaurants}
          onClose={() => setCouponFor(null)}
          onSubmit={async (payload, originalCode) => {
            const result = await act(
              { action: "coupon-upsert", coupon: payload, originalCode },
              originalCode ? "Kampanya güncellendi." : "Kampanya oluşturuldu."
            );
            if (result) setCouponFor(null);
          }}
        />
      )}

      {/* Afiş formu */}
      {bannerFor && (
        <BannerModal
          banner={bannerFor === "new" ? null : bannerFor}
          onClose={() => setBannerFor(null)}
          onSubmit={async (payload) => {
            const result = await act(
              { action: "banner-upsert", banner: payload },
              payload.id ? "Afiş güncellendi." : "Afiş eklendi."
            );
            if (result) setBannerFor(null);
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return;
          void act(
            deleting.kind === "coupon"
              ? { action: "coupon-delete", code: deleting.id }
              : { action: "banner-delete", id: deleting.id },
            `"${deleting.name}" silindi.`
          );
        }}
        title={deleting?.kind === "coupon" ? "Kampanyayı sil" : "Afişi sil"}
        description={`"${deleting?.name}" kalıcı olarak kaldırılacak.`}
        confirmLabel="Sil"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function PushComposer({
  districts,
  campaigns,
  onSend,
}: {
  districts: string[];
  campaigns: PushCampaign[];
  onSend: (push: {
    title: string;
    body: string;
    segment: PushCampaign["segment"];
    districts: string[];
  }) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [segment, setSegment] = useState<PushCampaign["segment"]>("all");
  const [picked, setPicked] = useState<string[]>([]);
  const [audience, setAudience] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const key = useDebounced(`${segment}|${picked.join(",")}`, 250);

  useEffect(() => {
    const [seg, list] = key.split("|");
    api
      .get<Snapshot>(
        `/admin/marketing?segment=${seg}&districts=${encodeURIComponent(list)}`
      )
      .then((data) => setAudience(data.audienceCount ?? 0))
      .catch(() => setAudience(null));
  }, [key]);

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <section className="card p-5">
        <h2 className="font-display text-base font-extrabold text-ink">
          Yeni bildirim
        </h2>

        <div className="mt-4 space-y-4">
          <Field label="Başlık" required>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={60}
              placeholder="Akşam yemeği hazır mı?"
            />
          </Field>

          <Field label="Mesaj" required hint={`${body.length}/240`}>
            <Textarea
              rows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={240}
              placeholder="Bu akşam çevrendeki restoranlarda teslimat ücretsiz. Kod: BEDAVAYOL"
            />
          </Field>

          <div>
            <p className="mb-2 text-sm font-semibold text-ink">
              Kullanıcı segmenti
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {SEGMENTS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSegment(item.id)}
                  className={cn(
                    "rounded-xl border p-3 text-left transition-colors",
                    segment === item.id
                      ? "border-brand bg-brand-soft"
                      : "border-border bg-surface hover:bg-surface-2"
                  )}
                >
                  <span className="block text-sm font-bold text-ink">
                    {item.label}
                  </span>
                  <span className="block text-xs text-muted">{item.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-ink">
              Bölge{" "}
              <span className="font-normal text-muted">
                (seçmezsen tüm bölgeler)
              </span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {districts.map((district) => {
                const active = picked.includes(district);
                return (
                  <button
                    key={district}
                    type="button"
                    onClick={() =>
                      setPicked((current) =>
                        active
                          ? current.filter((d) => d !== district)
                          : [...current, district]
                      )
                    }
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                      active
                        ? "border-brand bg-brand text-brand-contrast"
                        : "border-border bg-surface text-ink hover:bg-surface-2"
                    )}
                  >
                    {district}
                  </button>
                );
              })}
              {districts.length === 0 && (
                <p className="text-sm text-muted">
                  Henüz kayıtlı adres yok, bölge filtresi kullanılamıyor.
                </p>
              )}
            </div>
          </div>

          <div className="tabular flex items-center justify-between rounded-xl bg-surface-2 px-4 py-3">
            <span className="text-sm text-muted">Hedef kitle</span>
            <span className="font-display text-lg font-extrabold text-ink">
              {audience === null ? "—" : `${audience} kişi`}
            </span>
          </div>

          <Button
            block
            size="lg"
            loading={busy}
            disabled={
              title.trim().length < 3 || body.trim().length < 5 || audience === 0
            }
            onClick={async () => {
              setBusy(true);
              await onSend({ title, body, segment, districts: picked });
              setTitle("");
              setBody("");
              setBusy(false);
            }}
          >
            <Send className="size-4" />
            Bildirimi gönder
          </Button>

          <p className="text-xs leading-relaxed text-muted">
            Prototipte bildirim gerçekten iletilmez; hedef kitle hesaplanır ve
            gönderim kaydı tutulur. Üretimde bu adım APNs/FCM sağlayıcısına
            bağlanır.
          </p>
        </div>
      </section>

      {/* Önizleme + geçmiş */}
      <aside className="space-y-4">
        <div className="card p-4">
          <p className="mb-2 text-xs font-semibold text-muted">Önizleme</p>
          <div className="rounded-2xl border border-border bg-surface-2 p-3.5">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-brand text-sm">
                🍽️
              </span>
              <span className="text-xs font-semibold text-muted">
                Sofra · şimdi
              </span>
            </div>
            <p className="mt-2 text-sm font-bold text-ink">
              {title.trim() || "Bildirim başlığı"}
            </p>
            <p className="mt-0.5 text-sm text-muted">
              {body.trim() || "Mesaj metni burada görünecek."}
            </p>
          </div>
        </div>

        <section className="card overflow-hidden">
          <h3 className="font-display border-b border-border px-4 py-3 text-sm font-extrabold text-ink">
            Gönderim geçmişi
          </h3>
          {campaigns.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted">
              Henüz bildirim gönderilmedi.
            </p>
          ) : (
            <ul className="max-h-96 divide-y divide-border overflow-y-auto">
              {campaigns.map((campaign) => (
                <li key={campaign.id} className="px-4 py-3">
                  <p className="text-sm font-bold text-ink">{campaign.title}</p>
                  <p className="line-clamp-2 text-xs text-muted">
                    {campaign.body}
                  </p>
                  <p className="tabular mt-1 text-[11px] text-muted">
                    {campaign.recipientCount} kişi ·{" "}
                    {SEGMENTS.find((s) => s.id === campaign.segment)?.label}
                    {campaign.districts.length
                      ? ` · ${campaign.districts.join(", ")}`
                      : ""}{" "}
                    · {relativeTime(campaign.sentAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </aside>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function CouponModal({
  coupon,
  restaurants,
  onClose,
  onSubmit,
}: {
  coupon: Coupon | null;
  restaurants: { id: string; name: string; emoji: string }[];
  onClose: () => void;
  onSubmit: (
    payload: Record<string, unknown>,
    originalCode?: string
  ) => Promise<void>;
}) {
  const [code, setCode] = useState(coupon?.code ?? "");
  const [title, setTitle] = useState(coupon?.title ?? "");
  const [description, setDescription] = useState(coupon?.description ?? "");
  const [type, setType] = useState<Coupon["type"]>(coupon?.type ?? "percent");
  const [value, setValue] = useState(String(coupon?.value ?? 10));
  const [minSubtotal, setMinSubtotal] = useState(
    String(coupon?.minSubtotal ?? 200)
  );
  const [maxDiscount, setMaxDiscount] = useState(
    coupon?.maxDiscount ? String(coupon.maxDiscount) : ""
  );
  const [firstOrderOnly, setFirstOrderOnly] = useState(
    Boolean(coupon?.firstOrderOnly)
  );
  const [restricted, setRestricted] = useState(Boolean(coupon?.restaurantIds));
  const [picked, setPicked] = useState<string[]>(coupon?.restaurantIds ?? []);
  const [expiresAt, setExpiresAt] = useState(
    (coupon?.expiresAt ?? new Date(Date.now() + 30 * 86400000).toISOString()).slice(
      0,
      10
    )
  );
  const [active, setActive] = useState(coupon?.active !== false);
  const [busy, setBusy] = useState(false);

  return (
    <Modal
      open
      onClose={onClose}
      title={coupon ? "Kampanyayı düzenle" : "Yeni kampanya"}
      description="Kod, müşterinin ödeme adımında gireceği promosyon kodudur."
      size="lg"
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" block onClick={onClose}>
            Vazgeç
          </Button>
          <Button
            block
            size="lg"
            loading={busy}
            disabled={code.trim().length < 3 || title.trim().length < 3}
            onClick={async () => {
              setBusy(true);
              await onSubmit(
                {
                  code,
                  title,
                  description,
                  type,
                  value: Number(value.replace(",", ".")),
                  minSubtotal: Number(minSubtotal.replace(",", ".")),
                  maxDiscount: maxDiscount
                    ? Number(maxDiscount.replace(",", "."))
                    : null,
                  restaurantIds: restricted && picked.length ? picked : null,
                  firstOrderOnly,
                  expiresAt: new Date(`${expiresAt}T23:59:59`).toISOString(),
                  active,
                },
                coupon?.code
              );
              setBusy(false);
            }}
          >
            {coupon ? "Değişiklikleri kaydet" : "Kampanyayı oluştur"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Kod" required hint="Harf ve rakam, 3-20 karakter.">
            <Input
              value={code}
              onChange={(e) =>
                setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
              }
              placeholder="YENI50"
              maxLength={20}
              className="font-mono uppercase"
            />
          </Field>
          <Field label="Bitiş tarihi" required>
            <Input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="tabular"
            />
          </Field>
        </div>

        <Field label="Başlık" required>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={60}
            placeholder="İlk siparişe 50 ₺ indirim"
          />
        </Field>

        <Field label="Açıklama" hint="Kampanyalar sayfasında görünür.">
          <Textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={160}
            placeholder="250 ₺ ve üzeri ilk siparişinde geçerlidir."
          />
        </Field>

        <div>
          <p className="mb-2 text-sm font-semibold text-ink">İndirim tipi</p>
          <div className="flex gap-1 rounded-xl bg-surface-2 p-1">
            {(
              [
                ["percent", "Yüzde"],
                ["amount", "Tutar"],
                ["free_delivery", "Ücretsiz teslimat"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setType(id)}
                className={cn(
                  "flex-1 rounded-lg py-2 text-sm font-bold transition-colors",
                  type === id
                    ? "bg-surface text-ink shadow-sm"
                    : "text-muted hover:text-ink"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {type !== "free_delivery" && (
            <Field label={type === "percent" ? "Yüzde (%)" : "Tutar (₺)"} required>
              <Input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                inputMode="decimal"
                className="tabular"
              />
            </Field>
          )}
          <Field label="Min. sepet (₺)">
            <Input
              value={minSubtotal}
              onChange={(e) => setMinSubtotal(e.target.value)}
              inputMode="decimal"
              className="tabular"
            />
          </Field>
          {type === "percent" && (
            <Field label="En fazla indirim (₺)" hint="Boş bırakılabilir.">
              <Input
                value={maxDiscount}
                onChange={(e) => setMaxDiscount(e.target.value)}
                inputMode="decimal"
                className="tabular"
              />
            </Field>
          )}
        </div>

        <div className="space-y-2">
          <Switch
            checked={firstOrderOnly}
            onChange={setFirstOrderOnly}
            label="Yalnızca ilk siparişte geçerli"
            description="Daha önce sipariş vermiş kullanıcılar kullanamaz."
          />
          <Switch
            checked={restricted}
            onChange={setRestricted}
            label="Belirli restoranlarla sınırla"
            description="Kapalıyken tüm restoranlarda geçerlidir."
          />
          <Switch
            checked={active}
            onChange={setActive}
            label="Yayında"
            description="Kapatırsan kod çalışmaz ve listelerde görünmez."
          />
        </div>

        {restricted && (
          <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-border p-2">
            {restaurants.map((r) => {
              const on = picked.includes(r.id);
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() =>
                    setPicked((current) =>
                      on ? current.filter((id) => id !== r.id) : [...current, r.id]
                    )
                  }
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                    on ? "bg-brand-soft" : "hover:bg-surface-2"
                  )}
                >
                  <span>{r.emoji}</span>
                  <span className="min-w-0 flex-1 truncate text-ink">
                    {r.name}
                  </span>
                  <span
                    className={cn(
                      "size-4 shrink-0 rounded-md border-2",
                      on ? "border-brand bg-brand" : "border-border-strong"
                    )}
                  />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}

function BannerModal({
  banner,
  onClose,
  onSubmit,
}: {
  banner: Banner | null;
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const [title, setTitle] = useState(banner?.title ?? "");
  const [subtitle, setSubtitle] = useState(banner?.subtitle ?? "");
  const [code, setCode] = useState(banner?.code ?? "");
  const [emoji, setEmoji] = useState(banner?.emoji ?? "🎉");
  const [gradient, setGradient] = useState<[string, string]>(
    banner?.gradient ?? GRADIENTS[0]
  );
  const [href, setHref] = useState(banner?.href ?? "/");
  const [active, setActive] = useState(banner?.active !== false);
  const [busy, setBusy] = useState(false);

  const EMOJIS = ["🎉", "🛵", "🍔", "🍰", "🥗", "☕", "🔥", "⭐", "🎁", "🌙"];

  return (
    <Modal
      open
      onClose={onClose}
      title={banner ? "Afişi düzenle" : "Yeni afiş"}
      description="Anasayfa vitrininde dönen kampanya afişi."
      size="md"
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" block onClick={onClose}>
            Vazgeç
          </Button>
          <Button
            block
            size="lg"
            loading={busy}
            disabled={title.trim().length < 3}
            onClick={async () => {
              setBusy(true);
              await onSubmit({
                id: banner?.id,
                title,
                subtitle,
                code: code || undefined,
                emoji,
                gradient,
                href,
                active,
              });
              setBusy(false);
            }}
          >
            Kaydet
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Canlı önizleme */}
        <div
          className="relative flex items-center gap-4 overflow-hidden rounded-3xl p-6 text-white"
          style={{
            backgroundImage: `linear-gradient(120deg, ${gradient[0]}, ${gradient[1]})`,
          }}
        >
          <span
            aria-hidden
            className="absolute -right-5 -top-7 text-[7.5rem] opacity-20"
          >
            {emoji}
          </span>
          <span className="relative min-w-0 flex-1">
            <span className="font-display block text-xl font-extrabold leading-tight">
              {title.trim() || "Afiş başlığı"}
            </span>
            <span className="mt-1 block text-sm text-white/85">
              {subtitle.trim() || "Alt başlık"}
            </span>
            {code && (
              <span className="mt-3 inline-block rounded-lg bg-white/20 px-2.5 py-1 font-mono text-xs font-bold">
                {code}
              </span>
            )}
          </span>
        </div>

        <Field label="Başlık" required>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={50}
          />
        </Field>
        <Field label="Alt başlık">
          <Input
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            maxLength={70}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Kampanya kodu" hint="Tıklayınca panoya kopyalanır.">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={20}
              className="font-mono uppercase"
            />
          </Field>
          <Field label="Bağlantı" hint="Site içi yol.">
            <Input
              value={href}
              onChange={(e) => setHref(e.target.value)}
              placeholder="/?kategori=burger"
            />
          </Field>
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-ink">Simge</p>
          <div className="flex flex-wrap gap-1.5">
            {EMOJIS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setEmoji(item)}
                className={cn(
                  "flex size-9 items-center justify-center rounded-lg border text-lg transition-colors",
                  emoji === item
                    ? "border-brand bg-brand-soft"
                    : "border-border bg-surface hover:bg-surface-2"
                )}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-ink">Renk</p>
          <div className="flex flex-wrap gap-2">
            {GRADIENTS.map((g) => (
              <button
                key={g.join()}
                type="button"
                onClick={() => setGradient(g)}
                aria-label={`Renk ${g[0]}`}
                className={cn(
                  "size-10 rounded-xl transition-transform",
                  gradient.join() === g.join()
                    ? "ring-2 ring-brand ring-offset-2 ring-offset-surface"
                    : "hover:scale-105"
                )}
                style={{
                  backgroundImage: `linear-gradient(120deg, ${g[0]}, ${g[1]})`,
                }}
              />
            ))}
          </div>
        </div>

        <Switch
          checked={active}
          onChange={setActive}
          label="Vitrinde göster"
          description="Kapatırsan afiş anasayfada görünmez."
        />
      </div>
    </Modal>
  );
}

function IconButton({
  children,
  label,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "rounded-lg p-2 text-muted transition-colors disabled:opacity-35",
        danger
          ? "hover:bg-danger-soft hover:text-danger"
          : "hover:bg-surface-2 hover:text-ink"
      )}
    >
      {children}
    </button>
  );
}
