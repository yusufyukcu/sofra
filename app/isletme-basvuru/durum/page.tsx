import type { Metadata } from "next";
import Link from "next/link";
import { ApplicationStatus } from "@/components/partner/application-status";

export const metadata: Metadata = {
  title: "Başvuru durumu",
  description: "Restoran katılım başvurunun durumunu referans kodunla sorgula.",
};

/**
 * Başvuru durumu sayfası.
 *
 * Kod adres çubuğundan gelebilir (`?kod=SF-BV-4H2K`) — başvuru sonrası
 * verilen bağlantı doğrudan sonucu açsın diye.
 */
export default async function ApplicationStatusPage(
  props: PageProps<"/isletme-basvuru/durum">
) {
  const searchParams = await props.searchParams;
  const raw = searchParams.kod;
  const code = Array.isArray(raw) ? raw[0] : raw;

  return (
    <div className="mx-auto max-w-5xl px-4 pt-8 lg:px-6 lg:pt-12">
      <header className="mb-8 text-center">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">
          Başvuru durumu
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
          Referans kodunu gir, başvurunun hangi aşamada olduğunu gör.
        </p>
      </header>

      <ApplicationStatus initialCode={code} />

      <p className="mt-8 text-center text-sm text-muted">
        Henüz başvurmadın mı?{" "}
        <Link
          href="/isletme-basvuru"
          className="font-semibold text-brand hover:underline"
        >
          Restoranını ekle
        </Link>
      </p>
    </div>
  );
}
