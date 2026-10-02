import type { Metadata } from "next";
import Link from "next/link";
import {
  BadgePercent,
  Bike,
  ChefHat,
  LayoutDashboard,
  TrendingUp,
} from "lucide-react";
import { publishedRestaurants } from "@/lib/db/store";
import { Button } from "@/components/ui/primitives";
import { ApplicationForm } from "@/components/partner/application-form";

export const metadata: Metadata = {
  title: "Restoranını Sofra'ya ekle",
  description:
    "Sofra'da restoranın olsun: binlerce müşteriye görün, siparişleri tek panelden yönet, teslimatı Sofra kuryelerine bırak. Başvuru ücretsiz.",
};

/**
 * İş ortaklığı sayfası.
 *
 * Yapı ikna sırasına göre: ne kazanırsın → nasıl işler → ne kadar tutar →
 * başvuru formu → merak edilenler. Form sayfanın sonunda değil ortasında,
 * çünkü kararını veren kişiyi daha fazla metin okutmaya zorlamamak gerekir.
 */

const BENEFITS = [
  {
    icon: TrendingUp,
    title: "Yeni müşteriye ulaş",
    body: "Mahallende yemek arayan kullanıcılar seni listede görür. Yeni açılan işletmeler ilk ay “Yeni” rozetiyle öne çıkar.",
  },
  {
    icon: LayoutDashboard,
    title: "Tek panelden yönet",
    body: "Siparişler mutfak tabletine zil sesiyle düşer. Menü, fiyat, stok ve çalışma saatlerini istediğin an değiştirirsin.",
  },
  {
    icon: Bike,
    title: "Teslimat bizde",
    body: "Kuryen yoksa siparişi en yakın Sofra kuryesi alır. Kendi kuryenle çalışmak istersen o da mümkün.",
  },
  {
    icon: BadgePercent,
    title: "Şeffaf hakediş",
    body: "Komisyon ve kesintiler panelde kalem kalem görünür. Haftalık hakediş kuyruğa düşer, ödendiğinde durumu anında değişir.",
  },
];

const STEPS = [
  {
    title: "Başvurunu gönder",
    body: "İşletme bilgilerini ve konumunu gir. Birkaç dakika sürer, ücretsizdir.",
  },
  {
    title: "Değerlendirelim",
    body: "Ekibimiz başvuruyu inceler ve gerekirse seni arar. Referans kodunla durumu takip edebilirsin.",
  },
  {
    title: "Menünü hazırla",
    body: "Onaylandığında panel girişin açılır. Ürünleri, varyantları ve fiyatları kendin girersin.",
  },
  {
    title: "Mağazanı aç",
    body: "Menü hazır olunca mağazanı yayına alırsın ve siparişler düşmeye başlar.",
  },
];

const FAQ = [
  {
    q: "Başvuru ücretli mi?",
    a: "Hayır. Başvuru ve kurulum ücretsizdir; herhangi bir aylık sabit ücret de alınmaz. Yalnızca gerçekleşen siparişlerden komisyon alınır.",
  },
  {
    q: "Komisyon oranı ne kadar?",
    a: "Yeni işletmeler için varsayılan oran %12'dir. Oran işletme bazlı belirlenir ve panelindeki Finans ekranında her zaman görünür.",
  },
  {
    q: "Ne zaman yayına girerim?",
    a: "Başvurular genellikle 3 iş günü içinde sonuçlanır. Onaydan sonra menünü hazırlayıp mağazanı açtığın anda listede görünürsün.",
  },
  {
    q: "Kendi kuryemle çalışabilir miyim?",
    a: "Evet. Başvuruda “Kendi kuryem var” seçeneğini işaretlersen teslimatı sen yönetirsin. İstediğin zaman panelden Sofra kuryelerine geçebilirsin.",
  },
  {
    q: "Menümü kim giriyor?",
    a: "Sen giriyorsun. İşletme panelinde kategori, ürün, varyant grubu ve fiyat ekleme ekranları hazır; stok durumunu tek dokunuşla değiştirebilirsin.",
  },
  {
    q: "Siparişleri reddedebilir miyim?",
    a: "Evet. Otomatik onayı kapatırsan her sipariş önce onayına düşer; kabul etmediğin sipariş müşteriye iade edilir.",
  },
  {
    q: "Ödemelerimi ne zaman alırım?",
    a: "Hakedişler haftalık olarak hesaplanır. Onaylandıktan sonra ödeme yapılır ve durumu panelinde “Ödendi” olarak görünür.",
  },
  {
    q: "Birden fazla şubem var, ne yapmalıyım?",
    a: "Tek başvuruda şube sayısını belirtmen yeterli. Değerlendirme sırasında şubeleri birlikte ele alıyoruz.",
  },
];

export default function PartnerPage() {
  const restaurantCount = publishedRestaurants().length;

  return (
    <div className="pb-16">
      {/* Hero */}
      <section className="band-deep grain">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:px-6 lg:py-20">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-deep-2 px-3.5 py-1.5 text-xs font-semibold text-on-deep-muted">
              <ChefHat className="size-3.5" aria-hidden />
              Sofra iş ortaklığı
            </span>

            <h1 className="font-display mt-5 text-[2.5rem] font-extrabold leading-[1.05] tracking-tight text-on-deep sm:text-5xl">
              Mutfağın hazır.
              <br />
              Müşteriyi biz getirelim.
            </h1>

            <p className="mt-5 max-w-xl text-base leading-relaxed text-on-deep-muted sm:text-lg">
              {/* Sayı değiştiği için ek kullanılmıyor: "15'ten" ile
                  "12'den" farklı ek ister, şablonda doğrusunu üretmek
                  gereksiz karmaşa olurdu. */}
              Sofra&apos;da her gün {restaurantCount} restoran sipariş alıyor.
              Sen de listede ol; siparişi tek panelden yönet, teslimatı
              kuryelerimize bırak.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="#basvuru">
                <Button size="lg" block>
                  Ücretsiz başvur
                </Button>
              </Link>
              <Link href="/isletme-basvuru/durum">
                <Button
                  size="lg"
                  variant="outline"
                  block
                  className="border-on-deep-muted/40 text-on-deep hover:bg-deep-2"
                >
                  Başvurumu sorgula
                </Button>
              </Link>
            </div>

            <dl className="mt-10 grid max-w-md grid-cols-3 gap-4 border-t border-on-deep-muted/20 pt-6">
              {[
                ["%12", "komisyon"],
                ["3 gün", "değerlendirme"],
                ["0 ₺", "kurulum"],
              ].map(([value, label]) => (
                <div key={label}>
                  <dt className="font-display tabular text-2xl font-extrabold text-on-deep">
                    {value}
                  </dt>
                  <dd className="mt-0.5 text-xs text-on-deep-muted">{label}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Panelin ne olduğunu anlatan minik önizleme */}
          <div className="hidden lg:block">
            <div className="rounded-3xl border border-on-deep-muted/20 bg-deep-2 p-5 shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-on-deep">
                  Bugünün siparişleri
                </span>
                <span className="rounded-full bg-pistachio-soft px-2.5 py-1 text-xs font-semibold text-pistachio">
                  Mağaza açık
                </span>
              </div>

              <div className="mt-4 space-y-2.5">
                {[
                  ["SF-4H2K9", "Onay bekliyor", "2 ürün", "bg-saffron-soft text-saffron"],
                  ["SF-8PQ2M", "Hazırlanıyor", "4 ürün", "bg-brand-soft text-brand"],
                  ["SF-3TR7B", "Kurye aldı", "1 ürün", "bg-info-soft text-info"],
                ].map(([code, status, items, tone]) => (
                  <div
                    key={code}
                    className="flex items-center gap-3 rounded-xl bg-deep-3 px-3.5 py-3"
                  >
                    <span className="tabular text-xs font-semibold text-on-deep-muted">
                      {code}
                    </span>
                    <span className="flex-1 text-xs text-on-deep-muted">
                      {items}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone}`}
                    >
                      {status}
                    </span>
                  </div>
                ))}
              </div>

              <p className="mt-4 text-xs leading-relaxed text-on-deep-muted">
                İşletme paneli böyle görünür: sipariş düştüğünde zil çalar,
                hazırlık süresini sen belirlersin.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Avantajlar */}
      <section className="mx-auto max-w-6xl px-4 py-14 lg:px-6 lg:py-18">
        <h2 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
          Neden Sofra?
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          Sipariş almaktan hakedişi görmeye kadar her adım tek yerde.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {BENEFITS.map(({ icon: Icon, title, body }) => (
            <article key={title} className="card p-6">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-brand-soft">
                <Icon className="size-5 text-brand" aria-hidden />
              </span>
              <h3 className="font-display mt-4 text-lg font-bold tracking-tight">
                {title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Süreç */}
      <section className="border-y border-border bg-surface-2">
        <div className="mx-auto max-w-6xl px-4 py-14 lg:px-6 lg:py-18">
          <h2 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
            Nasıl işliyor?
          </h2>
          <p className="mt-2 text-sm text-muted">
            Başvurudan ilk siparişe dört adım.
          </p>

          {/* Numaralandırma burada gerçek bir sıra bildiriyor: adımlar
              birbirinin önkoşulu. */}
          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, index) => (
              <li key={step.title} className="card p-5">
                <span className="font-display tabular flex size-9 items-center justify-center rounded-xl bg-deep text-sm font-extrabold text-on-deep">
                  {index + 1}
                </span>
                <h3 className="font-display mt-3.5 text-base font-bold tracking-tight">
                  {step.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Form */}
      <section id="basvuru" className="mx-auto max-w-6xl px-4 py-14 lg:px-6 lg:py-18">
        <div className="mx-auto mb-8 max-w-2xl text-center">
          <h2 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
            Başvuru formu
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Birkaç dakikanı alır. Ücretsizdir ve seni bağlamaz.
          </p>
        </div>

        <ApplicationForm />
      </section>

      {/* SSS */}
      <section className="mx-auto max-w-3xl px-4 lg:px-6">
        <h2 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
          Merak edilenler
        </h2>

        <div className="mt-6 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
          {FAQ.map((item) => (
            <details key={item.q} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-semibold text-ink transition-colors hover:bg-surface-2">
                {item.q}
                <span
                  aria-hidden
                  className="text-muted transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="px-5 pb-4 text-sm leading-relaxed text-muted">
                {item.a}
              </p>
            </details>
          ))}
        </div>

        <div className="mt-8 rounded-2xl border border-border bg-surface-2 p-6 text-center">
          <p className="text-sm text-muted">Sorun mu var?</p>
          <Link
            href="/destek"
            className="font-display mt-1 inline-block text-lg font-bold tracking-tight text-brand hover:underline"
          >
            Destek ekibiyle konuş
          </Link>
        </div>
      </section>
    </div>
  );
}
