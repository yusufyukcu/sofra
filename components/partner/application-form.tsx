"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, Copy, MapPin, Send } from "lucide-react";
import { CATEGORIES, DEFAULT_CENTER } from "@/lib/constants";
import type { LatLng } from "@/lib/types";
import { api, errorMessage } from "@/lib/api-client";
import { PickerMap } from "@/components/map";
import {
  Button,
  Field,
  Input,
  Switch,
  Textarea,
} from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";

/**
 * Restoran başvuru formu.
 *
 * Üç bölüm: işletme, konum, yetkili. Konum haritadan seçilir — adres metni
 * tek başına teslimat yarıçapını hesaplamaya yetmiyor, koordinat gerekiyor.
 *
 * Doğrulama sunucuda yapılır; buradaki kontroller yalnızca kullanıcıyı
 * boş yere sunucuya göndermemek için. Hata kodları sunucudan gelir ve
 * ilgili alanın altında gösterilir.
 */

const CUISINES = CATEGORIES.filter(
  (c) => c.id !== "all" && c.id !== "top-rated"
);

/** Sunucu hata kodu → formdaki alan. */
const FIELD_OF_ERROR: Record<string, string> = {
  invalid_business_name: "businessName",
  invalid_cuisine: "cuisine",
  invalid_city: "city",
  invalid_district: "district",
  invalid_address: "address",
  invalid_location: "location",
  invalid_contact_name: "contactName",
  invalid_phone: "phone",
  invalid_email: "email",
  invalid_tax_number: "taxNumber",
};

interface Submitted {
  code: string;
  businessName: string;
}

export function ApplicationForm() {
  const toast = useToast();

  const [businessName, setBusinessName] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [city, setCity] = useState("İstanbul");
  const [district, setDistrict] = useState("");
  const [address, setAddress] = useState("");
  const [location, setLocation] = useState<LatLng>(DEFAULT_CENTER);
  const [locationTouched, setLocationTouched] = useState(false);
  const [branchCount, setBranchCount] = useState("1");

  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [taxNumber, setTaxNumber] = useState("");
  const [hasOwnCourier, setHasOwnCourier] = useState(false);
  const [monthlyOrders, setMonthlyOrders] = useState("");
  const [note, setNote] = useState("");

  const [busy, setBusy] = useState(false);
  const [fieldError, setFieldError] = useState<{ field: string; message: string } | null>(null);
  const [done, setDone] = useState<Submitted | null>(null);

  const errorFor = (field: string) =>
    fieldError?.field === field ? fieldError.message : undefined;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFieldError(null);

    try {
      const data = await api.post<Submitted>("/partner/apply", {
        businessName,
        cuisine,
        city,
        district,
        address,
        location,
        branchCount: Number(branchCount) || 1,
        contactName,
        phone,
        email,
        taxNumber: taxNumber || undefined,
        hasOwnCourier,
        monthlyOrders: monthlyOrders || undefined,
        note: note || undefined,
      });
      setDone(data);
    } catch (err) {
      const code =
        err && typeof err === "object" && "code" in err
          ? String((err as { code: unknown }).code)
          : "";
      const field = FIELD_OF_ERROR[code];
      const message = errorMessage(err);

      if (field) {
        setFieldError({ field, message });
        document
          .getElementById(`alan-${field}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      } else {
        toast.error(message);
      }
    } finally {
      setBusy(false);
    }
  }

  /* ---------------------------------------------------------------- */
  /* Başvuru alındı                                                    */
  /* ---------------------------------------------------------------- */

  if (done) {
    return (
      <div className="card mx-auto max-w-xl p-8 text-center">
        <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-pistachio-soft">
          <CheckCircle2 className="size-8 text-pistachio" aria-hidden />
        </span>

        <h2 className="font-display mt-5 text-2xl font-extrabold tracking-tight">
          Başvurun alındı
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          <strong className="text-ink">{done.businessName}</strong> için
          başvurun değerlendirmeye alındı. Ekibimiz 3 iş günü içinde dönüş
          yapacak; onaylandığında işletme paneli girişin açılır.
        </p>

        <div className="mt-6 rounded-2xl border border-border bg-surface-2 p-4">
          <span className="block text-xs font-semibold uppercase tracking-wider text-muted">
            Referans kodun
          </span>
          <div className="mt-1.5 flex items-center justify-center gap-2">
            <code className="font-display tabular text-2xl font-extrabold tracking-wide text-ink">
              {done.code}
            </code>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard
                  ?.writeText(done.code)
                  .then(() => toast.success("Kod kopyalandı"))
                  .catch(() => toast.error("Kopyalanamadı"));
              }}
              aria-label="Referans kodunu kopyala"
              className="flex size-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-3 hover:text-ink"
            >
              <Copy className="size-4" aria-hidden />
            </button>
          </div>
          <p className="mt-2 text-xs text-muted">
            Bu kodu sakla — başvurunun durumunu bununla sorgulayabilirsin.
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
          <Link href={`/isletme-basvuru/durum?kod=${done.code}`}>
            <Button variant="secondary" block>
              Durumu sorgula
            </Button>
          </Link>
          <Link href="/">
            <Button variant="ghost" block>
              Anasayfaya dön
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /* Form                                                              */
  /* ---------------------------------------------------------------- */

  return (
    <form onSubmit={submit} className="mx-auto max-w-2xl space-y-8" noValidate>
      {/* İşletme */}
      <section className="card p-6">
        <h2 className="font-display text-lg font-extrabold tracking-tight">
          İşletme bilgileri
        </h2>
        <p className="mt-1 text-sm text-muted">
          Müşterilerin göreceği ad ve mutfak türü.
        </p>

        <div className="mt-5 space-y-4">
          <div id="alan-businessName">
            <Field label="İşletme adı" required error={errorFor("businessName")}>
              <Input
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Ör. Kasap Burger Co."
                maxLength={80}
                autoComplete="organization"
              />
            </Field>
          </div>

          <div id="alan-cuisine">
            <Field
              label="Mutfak türü"
              required
              error={errorFor("cuisine")}
              hint="Restoranın hangi kategoride listeleneceğini belirler."
            >
              <div className="mt-1 flex flex-wrap gap-2">
                {CUISINES.map((c) => {
                  const active = cuisine === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCuisine(c.id)}
                      aria-pressed={active}
                      className={
                        "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-semibold transition-colors " +
                        (active
                          ? "border-brand bg-brand-soft text-brand"
                          : "border-border bg-surface text-text hover:bg-surface-2")
                      }
                    >
                      <span aria-hidden>{c.emoji}</span>
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div id="alan-city">
              <Field label="Şehir" required error={errorFor("city")}>
                <Input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="İstanbul"
                  maxLength={40}
                  autoComplete="address-level1"
                />
              </Field>
            </div>
            <div id="alan-district">
              <Field label="İlçe" required error={errorFor("district")}>
                <Input
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  placeholder="Kadıköy"
                  maxLength={40}
                  autoComplete="address-level2"
                />
              </Field>
            </div>
          </div>

          <Field
            label="Şube sayısı"
            hint="Birden fazla şuben varsa hepsini tek başvuruyla değerlendiririz."
          >
            <Input
              type="number"
              min={1}
              max={999}
              value={branchCount}
              onChange={(e) => setBranchCount(e.target.value)}
              className="max-w-32"
            />
          </Field>
        </div>
      </section>

      {/* Konum */}
      <section className="card p-6">
        <h2 className="font-display text-lg font-extrabold tracking-tight">
          Konum
        </h2>
        <p className="mt-1 text-sm text-muted">
          Teslimat bölgen bu noktaya göre hesaplanır. Haritayı kaydırarak
          işletmenin tam yerini işaretle.
        </p>

        <div className="mt-5 space-y-4">
          <div id="alan-address">
            <Field label="Açık adres" required error={errorFor("address")}>
              <Textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Mahalle, cadde, no"
                rows={2}
                maxLength={200}
                autoComplete="street-address"
              />
            </Field>
          </div>

          <div id="alan-location">
            <Field
              label="Harita üzerinde konum"
              required
              error={errorFor("location")}
              hint={
                locationTouched
                  ? `Seçilen nokta: ${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`
                  : "Haritayı kaydır, pin işletmenin kapısında olsun."
              }
            >
              <div className="mt-1 overflow-hidden rounded-2xl border border-border">
                <PickerMap
                  value={location}
                  onChange={(p) => {
                    setLocation(p);
                    setLocationTouched(true);
                  }}
                  className="h-64 w-full"
                />
              </div>
            </Field>
          </div>

          <Switch
            checked={hasOwnCourier}
            onChange={setHasOwnCourier}
            label="Kendi kuryem var"
            description="Kapalıysa teslimatı Sofra kuryeleri üstlenir."
            icon={<MapPin className="size-4" aria-hidden />}
          />
        </div>
      </section>

      {/* Yetkili */}
      <section className="card p-6">
        <h2 className="font-display text-lg font-extrabold tracking-tight">
          Yetkili kişi
        </h2>
        <p className="mt-1 text-sm text-muted">
          Başvuru sonucunu ve panel giriş bilgilerini buraya ileteceğiz.
        </p>

        <div className="mt-5 space-y-4">
          <div id="alan-contactName">
            <Field label="Ad soyad" required error={errorFor("contactName")}>
              <Input
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Ad Soyad"
                maxLength={60}
                autoComplete="name"
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div id="alan-phone">
              <Field label="Cep telefonu" required error={errorFor("phone")}>
                <Input
                  value={phone}
                  onChange={(e) =>
                    setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))
                  }
                  placeholder="5XX XXX XX XX"
                  inputMode="numeric"
                  autoComplete="tel-national"
                />
              </Field>
            </div>
            <div id="alan-email">
              <Field label="E-posta" required error={errorFor("email")}>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="isletme@ornek.com"
                  maxLength={120}
                  autoComplete="email"
                />
              </Field>
            </div>
          </div>

          <div id="alan-taxNumber">
            <Field
              label="Vergi / T.C. kimlik numarası"
              error={errorFor("taxNumber")}
              hint="İsteğe bağlı — sözleşme aşamasında da verebilirsin."
            >
              <Input
                value={taxNumber}
                onChange={(e) =>
                  setTaxNumber(e.target.value.replace(/\D/g, "").slice(0, 11))
                }
                placeholder="10 veya 11 hane"
                inputMode="numeric"
                className="max-w-56"
              />
            </Field>
          </div>

          <Field
            label="Aylık tahmini sipariş"
            hint="İsteğe bağlı — paket önerisi için kullanıyoruz."
          >
            <Input
              value={monthlyOrders}
              onChange={(e) => setMonthlyOrders(e.target.value)}
              placeholder="Ör. 500-1000"
              maxLength={40}
              className="max-w-56"
            />
          </Field>

          <Field label="Eklemek istediğin bir şey var mı?">
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Çalışma saatleri, özel talepler…"
              rows={3}
              maxLength={500}
            />
          </Field>
        </div>
      </section>

      <div className="space-y-3">
        <Button type="submit" size="lg" block loading={busy}>
          <Send className="size-4.5" aria-hidden />
          Başvuruyu gönder
        </Button>
        <p className="text-center text-xs leading-relaxed text-muted">
          Göndererek ön değerlendirme için iletişim bilgilerinin
          kullanılmasını kabul etmiş olursun. Başvuru ücretsizdir ve
          bağlayıcı değildir.
        </p>
      </div>
    </form>
  );
}
