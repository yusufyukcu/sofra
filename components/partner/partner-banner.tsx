import { ArrowRight, Store } from "lucide-react";
import Link from "next/link";

/**
 * "Sofra'da restoranın olsun" — anasayfadaki kalıcı başvuru afişi.
 *
 * Kampanya afişleriyle aynı görsel dili kullanır ve her ziyarette görünür;
 * açılır pencere gibi araya girmez, kapatılınca kaybolmaz. Başvuru ve
 * durum sorgusu buradan açılır.
 */
const PERKS: [string, string][] = [
  ["%12", "komisyon"],
  ["3 gün", "içinde yayında"],
  ["0 ₺", "kurulum"],
];

export function PartnerBanner() {
  return (
    <section
      aria-labelledby="partner-banner-title"
      className="band-deep grain relative overflow-hidden rounded-3xl shadow-soft"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -right-6 -top-10 select-none text-[9rem] leading-none opacity-[0.12]"
      >
        🏪
      </span>

      <div className="relative flex flex-col gap-5 p-6 sm:p-7 lg:flex-row lg:items-center lg:gap-8">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-brand shadow-brand">
          <Store className="size-7 text-brand-contrast" aria-hidden />
        </span>

        <div className="min-w-0 flex-1">
          <h2
            id="partner-banner-title"
            className="font-display text-[1.6rem] font-extrabold leading-tight tracking-tight text-on-deep"
          >
            Sofra&apos;da restoranın olsun
          </h2>
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-on-deep-muted">
            Mahalleni arayan binlerce kişiye görün, siparişleri tek panelden
            yönet, teslimatı kurye ağımıza bırak.
          </p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {PERKS.map(([value, label]) => (
              <li
                key={label}
                className="rounded-xl bg-white/10 px-3 py-1.5 text-xs text-on-deep-muted"
              >
                <span className="font-display tabular mr-1 text-sm font-extrabold text-on-deep">
                  {value}
                </span>
                {label}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex shrink-0 flex-col gap-2.5 sm:flex-row sm:items-center lg:flex-col lg:items-stretch">
          <Link
            href="/isletme-basvuru"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-brand px-6 text-[15px] font-semibold text-brand-contrast shadow-brand transition-colors hover:bg-brand-hover"
          >
            Ücretsiz başvur
            <ArrowRight className="size-4.5" aria-hidden />
          </Link>
          <Link
            href="/isletme-basvuru/durum"
            className="text-center text-xs font-semibold text-on-deep-muted underline-offset-4 transition-colors hover:text-on-deep hover:underline"
          >
            Başvurun var mı? Durumunu sorgula
          </Link>
        </div>
      </div>
    </section>
  );
}
