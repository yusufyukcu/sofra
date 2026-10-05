import Link from "next/link";
import { APP_NAME } from "@/lib/constants";
import { Logo } from "@/components/brand/logo";

const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Keşfet",
    links: [
      { label: "Tüm restoranlar", href: "/" },
      { label: "Puanı yüksekler", href: "/?kategori=top-rated" },
      { label: "Hızlı teslimat", href: "/?sirala=eta" },
      { label: "Kampanyalar", href: "/kampanyalar" },
    ],
  },
  {
    title: "Hesabım",
    links: [
      { label: "Siparişlerim", href: "/hesabim/siparislerim" },
      { label: "Adreslerim", href: "/hesabim/adreslerim" },
      { label: "Favorilerim", href: "/hesabim/favorilerim" },
      { label: "Cüzdanım", href: "/hesabim/cuzdan" },
    ],
  },
  {
    title: "İş ortaklığı",
    links: [
      { label: "Restoranını ekle", href: "/isletme-basvuru" },
      { label: "Başvuru durumu", href: "/isletme-basvuru/durum" },
      { label: "Restoran paneli", href: "/isletme" },
      { label: "Kurye uygulaması", href: "/kurye" },
    ],
  },
  {
    title: "Yardım",
    links: [
      { label: "Canlı destek", href: "/destek" },
      { label: "Sıkça sorulan sorular", href: "/destek" },
      { label: "Yönetim paneli", href: "/yonetim" },
      { label: "Görsel kaynakları", href: "/gorsel-kaynaklari" },
    ],
  },
];

/**
 * Alt bant — patlıcan koyusu, beyaz sayfayı alttan çerçeveler.
 * İçerikten uzaklığını tek başına o belirler; sayfalar alt boşluk bırakmaz.
 */
export function Footer() {
  return (
    <footer className="site-footer band-deep mt-12 lg:mt-16">
      <div className="mx-auto max-w-7xl px-4 py-10 lg:px-6 lg:py-12">
        <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4 lg:grid-cols-5 lg:gap-x-10">
          <div className="col-span-2 sm:col-span-4 lg:col-span-1">
            <Logo tone="light" size="md" />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-on-deep-muted">
              Mahallendeki en iyi restoranlar tek uygulamada. Sipariş ver,
              kuryeni haritadan canlı takip et.
            </p>
            <p className="mt-4 text-xs text-on-deep-muted">
              Mobil uygulama iOS ve Android&apos;de çok yakında.
            </p>
          </div>

          {COLUMNS.map((column) => (
            <nav key={column.title}>
              <h3 className="font-display text-sm font-bold text-on-deep">
                {column.title}
              </h3>
              <ul className="mt-4 space-y-3">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-on-deep-muted transition-colors hover:text-on-deep"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-white/10 pt-6 text-xs leading-relaxed text-on-deep-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {APP_NAME}. Tüm hakları saklıdır.
          </p>
          <p>Ürün prototipi — ödemeler ve SMS doğrulama simüle edilir.</p>
        </div>
      </div>
    </footer>
  );
}
