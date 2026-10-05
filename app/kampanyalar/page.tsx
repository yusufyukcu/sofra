import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { activeBanners, allCoupons } from "@/lib/db/queries";
import { formatPrice } from "@/lib/utils";
import { Badge } from "@/components/ui/primitives";
import { BannerArt } from "@/components/discovery/banner-art";
import { CouponCode } from "@/components/discovery/coupon-code";

export const metadata: Metadata = {
  title: "Kampanyalar",
  description: "Güncel indirim kodları ve kampanyalar.",
};

export default async function CampaignsPage() {
  // Kampanyalar yönetici panelinden anında değişir: her istekte güncel oku
  await connection();
  const now = Date.now();
  const [allList, banners] = await Promise.all([allCoupons(), activeBanners()]);
  const coupons = allList.filter(
    (coupon) => coupon.active && new Date(coupon.expiresAt).getTime() > now
  );

  return (
    <div className="mx-auto max-w-5xl px-4 pt-6 lg:px-6 lg:pt-8">
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          Kampanyalar
        </h1>
        <p className="mt-2 text-sm text-muted">
          Kodu kopyala, ödeme adımında promosyon kodu alanına yapıştır.
        </p>
      </header>

      <div className="mb-10 grid gap-4 sm:grid-cols-2">
        {banners.map((banner) => (
          <Link
            key={banner.id}
            href={banner.href}
            className="group relative flex min-h-28 items-center gap-4 overflow-hidden rounded-2xl p-5 text-white shadow-soft transition-transform hover:-translate-y-0.5"
            style={{
              backgroundImage: `linear-gradient(120deg, ${banner.gradient[0]}, ${banner.gradient[1]})`,
            }}
          >
            <BannerArt banner={banner} sizes="(min-width: 640px) 240px, 50vw" />
            <span className={banner.image ? "relative pr-[34%]" : "relative"}>
              <span className="block text-lg font-extrabold">{banner.title}</span>
              <span className="mt-1 block text-sm text-white/85">
                {banner.subtitle}
              </span>
            </span>
          </Link>
        ))}
      </div>

      <h2 className="mb-4 text-lg font-extrabold text-text sm:text-xl">
        İndirim kodları
      </h2>
      <ul className="grid gap-4 sm:grid-cols-2">
        {coupons.map((coupon) => (
          <li key={coupon.code} className="card flex flex-col gap-3 p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-extrabold text-text">{coupon.title}</h3>
                <p className="mt-1 text-sm text-muted">{coupon.description}</p>
              </div>
              <Badge tone="brand">
                {coupon.type === "percent"
                  ? `%${coupon.value}`
                  : coupon.type === "free_delivery"
                    ? "Ücretsiz teslimat"
                    : formatPrice(coupon.value)}
              </Badge>
            </div>

            <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
              <div>
                <dt className="inline font-semibold">Min. sepet: </dt>
                <dd className="inline">{formatPrice(coupon.minSubtotal)}</dd>
              </div>
              {coupon.maxDiscount && (
                <div>
                  <dt className="inline font-semibold">En fazla: </dt>
                  <dd className="inline">{formatPrice(coupon.maxDiscount)}</dd>
                </div>
              )}
              {coupon.firstOrderOnly && (
                <div className="font-semibold text-brand">İlk siparişe özel</div>
              )}
            </dl>

            <CouponCode code={coupon.code} />
          </li>
        ))}
      </ul>
    </div>
  );
}
