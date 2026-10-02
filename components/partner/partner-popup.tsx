"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Store, X } from "lucide-react";
import { Button } from "@/components/ui/primitives";

/**
 * "Sofra'da restoranın olsun" davet penceresi.
 *
 * Anasayfa açıldıktan kısa bir süre sonra bir kez görünür. Kapatıldığında
 * 30 gün boyunca tekrar çıkmaz — bir daveti her ziyarette göstermek daveti
 * değil rahatsızlığı büyütür. Kalıcı giriş noktası alt bantta durur, o
 * yüzden kapatan kullanıcı yolu kaybetmez.
 *
 * Gecikme bilinçli: ilk boyamayla yarışmasın, kullanıcı sayfanın ne
 * olduğunu görsün, sonra davet gelsin.
 */

const STORAGE_KEY = "sofra:partner-invite";
const SNOOZE_DAYS = 30;
const DELAY_MS = 2600;

function snoozed(): boolean {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const until = Number(raw);
    return Number.isFinite(until) && until > Date.now();
  } catch {
    // Gizli sekmede localStorage kapalı olabilir; o durumda davet görünür.
    return false;
  }
}

function snooze() {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      String(Date.now() + SNOOZE_DAYS * 24 * 60 * 60 * 1000)
    );
  } catch {
    /* yazılamadıysa yalnızca bu oturumda gizlenir */
  }
}

export function PartnerPopup() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (snoozed()) return;
    const timer = setTimeout(() => setOpen(true), DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function close() {
    snooze();
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="partner-invite-title"
    >
      <button
        type="button"
        aria-label="Kapat"
        onClick={close}
        className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]"
      />

      <div className="card animate-slide-up relative w-full max-w-lg overflow-hidden rounded-b-none rounded-t-3xl p-0 shadow-lg sm:animate-fade-up sm:rounded-3xl">
        {/* Patlıcan bandı — sayfanın üst bandıyla aynı çapa */}
        <div className="band-deep grain relative px-6 pb-7 pt-7">
          <button
            type="button"
            onClick={close}
            aria-label="Kapat"
            className="absolute right-4 top-4 flex size-9 items-center justify-center rounded-full bg-deep-2 text-on-deep-muted transition-colors hover:text-on-deep"
          >
            <X className="size-4.5" aria-hidden />
          </button>

          <span className="flex size-12 items-center justify-center rounded-2xl bg-brand text-2xl shadow-brand">
            <Store className="size-6 text-brand-contrast" aria-hidden />
          </span>

          <h2
            id="partner-invite-title"
            className="font-display mt-4 text-[1.6rem] font-extrabold leading-tight tracking-tight text-on-deep"
          >
            Sofra&apos;da restoranın olsun
          </h2>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-on-deep-muted">
            Mahalleni arayan binlerce kişiye görün, siparişleri tek panelden
            yönet, teslimatı bize bırak.
          </p>
        </div>

        <div className="p-6">
          <dl className="grid grid-cols-3 gap-3 text-center">
            {[
              ["%12", "komisyon"],
              ["3 gün", "içinde yayında"],
              ["0 ₺", "kurulum"],
            ].map(([value, label]) => (
              <div
                key={label}
                className="rounded-2xl border border-border bg-surface-2 px-2 py-3"
              >
                <dt className="font-display tabular text-lg font-extrabold text-ink">
                  {value}
                </dt>
                <dd className="mt-0.5 text-xs text-muted">{label}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-5 flex flex-col gap-2.5">
            <Link href="/isletme-basvuru" onClick={close}>
              <Button size="lg" block>
                Ücretsiz başvur
                <ArrowRight className="size-4.5" aria-hidden />
              </Button>
            </Link>
            <Button variant="ghost" size="md" block onClick={close}>
              Şimdi değil
            </Button>
          </div>

          <p className="mt-3 text-center text-xs text-muted">
            Başvurun var mı?{" "}
            <Link
              href="/isletme-basvuru/durum"
              onClick={close}
              className="font-semibold text-brand hover:underline"
            >
              Durumunu sorgula
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
