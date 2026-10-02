"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Clock, Search, XCircle } from "lucide-react";
import { api, errorMessage } from "@/lib/api-client";
import { formatDateTime } from "@/lib/utils";
import { Button, Field, Input } from "@/components/ui/primitives";

/**
 * Başvuru durumu sorgulama.
 *
 * Referans kodu adres çubuğunda taşınabilir (`?kod=SF-BV-4H2K`), böylece
 * başvuru sonrası verilen bağlantı doğrudan sonucu açar.
 *
 * Sunucu yalnızca başvuranın görmesi gereken alanları döndürür — telefon,
 * e-posta ve vergi numarası bu cevapta yer almaz.
 */

interface StatusView {
  code: string;
  businessName: string;
  status: "received" | "approved" | "rejected";
  createdAt: string;
  decidedAt?: string;
  rejectionReason?: string;
  panelUrl?: string;
}

const STATE = {
  received: {
    icon: Clock,
    label: "Değerlendiriliyor",
    tone: "bg-saffron-soft text-saffron",
    body: "Başvurun ekibimizde. Sonuç genellikle 3 iş günü içinde belli olur; gerekirse seni ararız.",
  },
  approved: {
    icon: CheckCircle2,
    label: "Onaylandı",
    tone: "bg-pistachio-soft text-pistachio",
    body: "Tebrikler, işletmen Sofra'da. Panel parolanı belirlemen için başvurudaki e-posta adresine tek kullanımlık bir kurulum bağlantısı gönderdik. Parolanı belirledikten sonra panele e-posta ve parolanla girersin; menünü hazırlayıp mağazanı açtığında siparişler düşmeye başlar.",
  },
  rejected: {
    icon: XCircle,
    label: "Onaylanmadı",
    tone: "bg-danger-soft text-danger",
    body: "Bu başvuru olumsuz sonuçlandı. Eksikleri tamamlayıp yeniden başvurabilirsin.",
  },
} as const;

export function ApplicationStatus({ initialCode }: { initialCode?: string }) {
  const [code, setCode] = useState(initialCode ?? "");
  const [result, setResult] = useState<StatusView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const lookup = useCallback(async (value: string) => {
    const trimmed = value.trim().toUpperCase();
    if (!trimmed) return;

    setBusy(true);
    setError(null);
    try {
      setResult(
        await api.get<StatusView>(
          `/partner/apply?kod=${encodeURIComponent(trimmed)}`
        )
      );
    } catch (err) {
      setResult(null);
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }, []);

  // Bağlantıyla gelindiyse doğrudan sorgula.
  useEffect(() => {
    if (initialCode) void lookup(initialCode);
  }, [initialCode, lookup]);

  const state = result ? STATE[result.status] : null;
  const Icon = state?.icon;

  return (
    <div className="mx-auto max-w-lg">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void lookup(code);
        }}
        className="card p-6"
      >
        <Field
          label="Başvuru referans kodu"
          error={error ?? undefined}
          hint="Başvurunu gönderdiğinde verdiğimiz SF-BV ile başlayan kod."
        >
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="SF-BV-4H2K"
            autoCapitalize="characters"
            autoComplete="off"
            maxLength={12}
          />
        </Field>

        <Button type="submit" block loading={busy} className="mt-4">
          <Search className="size-4.5" aria-hidden />
          Sorgula
        </Button>
      </form>

      {result && state && Icon ? (
        <div className="card animate-fade-up mt-4 p-6">
          <div className="flex items-start gap-4">
            <span
              className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ${state.tone}`}
            >
              <Icon className="size-6" aria-hidden />
            </span>
            <div className="min-w-0">
              <span
                className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${state.tone}`}
              >
                {state.label}
              </span>
              <h2 className="font-display mt-2 text-xl font-extrabold tracking-tight">
                {result.businessName}
              </h2>
              <p className="tabular mt-0.5 text-xs text-muted">
                {result.code} · {formatDateTime(result.createdAt)}
              </p>
            </div>
          </div>

          <p className="mt-4 text-sm leading-relaxed text-muted">{state.body}</p>

          {result.status === "rejected" && result.rejectionReason ? (
            <p className="mt-3 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
              <strong className="font-semibold">Gerekçe:</strong>{" "}
              {result.rejectionReason}
            </p>
          ) : null}

          {result.decidedAt ? (
            <p className="tabular mt-3 text-xs text-muted">
              Karar tarihi: {formatDateTime(result.decidedAt)}
            </p>
          ) : null}

          <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
            {result.panelUrl ? (
              <Link href={result.panelUrl} className="flex-1">
                <Button block>İşletme paneline git</Button>
              </Link>
            ) : null}
            {result.status === "rejected" ? (
              <Link href="/isletme-basvuru#basvuru" className="flex-1">
                <Button variant="secondary" block>
                  Yeniden başvur
                </Button>
              </Link>
            ) : null}
            <Link href="/" className="flex-1">
              <Button variant="ghost" block>
                Anasayfa
              </Button>
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
