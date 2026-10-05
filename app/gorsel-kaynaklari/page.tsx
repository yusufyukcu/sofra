import type { Metadata } from "next";
import Image from "next/image";
import { ExternalLink } from "lucide-react";
import { IMAGE_CREDITS } from "@/lib/image-credits";

export const metadata: Metadata = {
  title: "Görsel kaynakları",
  description: "Sofra'daki yemek fotoğraflarının yazarları ve lisansları.",
};

/**
 * Fotoğraf atıfları.
 *
 * Yemek fotoğrafları Creative Commons lisanslıdır (CC BY, CC BY-SA, CC0).
 * BY lisansları kullanımda yazara ve lisansa atıf yapılmasını şart koşar;
 * bu sayfa o şartı karşılar. Fotoğraflar boyutlandırılmış, kırpılmış ve
 * renk/kontrast düzeltmesinden geçirilmiştir (BY-SA'nın istediği değişiklik notu).
 */
export default function ImageCreditsPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 pt-6 lg:px-6 lg:pt-8">
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          Görsel kaynakları
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          Restoran ve menü fotoğrafları Wikimedia Commons ve Flickr&apos;daki
          Creative Commons lisanslı görsellerden seçildi; boyutlandırıldı,
          kırpıldı ve renk, kontrast ve keskinlik düzeltmesi yapılarak
          kullanılıyor. Görseller temsilidir. Her fotoğrafın yazarı, lisansı
          ve özgün kaynağı aşağıda.
        </p>
      </header>

      {/* `grid-cols-1` = minmax(0, 1fr): uzun başlıklar sütunu genişletmesin */}
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {IMAGE_CREDITS.map((credit) => (
          <li key={credit.source} className="card flex min-w-0 gap-4 p-4">
            <span className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-surface-2">
              <Image
                src={credit.files[0]}
                alt=""
                fill
                sizes="64px"
                className="object-cover"
              />
            </span>
            <div className="min-w-0 flex-1 text-sm">
              <p className="truncate font-semibold text-ink" title={credit.title}>
                {credit.title}
              </p>
              <p className="mt-0.5 truncate text-muted" title={credit.creator}>
                {credit.creator || "Bilinmeyen yazar"}
              </p>
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                {credit.licenseUrl ? (
                  <a
                    href={credit.licenseUrl}
                    target="_blank"
                    rel="noopener noreferrer license"
                    className="font-semibold text-brand hover:underline"
                  >
                    {credit.license}
                  </a>
                ) : (
                  <span className="font-semibold text-text">{credit.license}</span>
                )}
                <a
                  href={credit.source}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-muted hover:text-text"
                >
                  Kaynak
                  <ExternalLink className="size-3" />
                </a>
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
