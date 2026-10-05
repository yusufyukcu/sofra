"use client";

import { Crosshair, MapPin } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { addressLabelIcon } from "@sofra/core";
import { Icon } from "@/components/ui/icon";
import { api, errorMessage } from "@/lib/api-client";
import { ADDRESS_LABELS, DEFAULT_CENTER } from "@/lib/constants";
import { QUICK_LOCATIONS, currentPosition, reverseGeocode } from "@/lib/geocode";
import { useSession } from "@/lib/store/session";
import type { Address, AddressLabel, LatLng } from "@/lib/types";
import { PickerMap } from "@/components/map";
import { Button, Chip, Field, Input, Switch, Textarea } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";

/**
 * Adres ekleme / düzenleme formu.
 *
 * Konum harita üzerinden pin ile seçilir; pin durduğunda ters coğrafi
 * kodlama ile mahalle/cadde ve ilçe otomatik doldurulur (kullanıcı henüz
 * elle değiştirmediyse).
 */

const DISTRICTS = [
  "Kadıköy",
  "Üsküdar",
  "Ataşehir",
  "Maltepe",
  "Beşiktaş",
  "Şişli",
  "Beyoğlu",
  "Bakırköy",
  "Sarıyer",
  "Ümraniye",
];

export function AddressForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial?: Address;
  onSaved: (address: Address, addresses: Address[]) => void;
  onCancel?: () => void;
}) {
  const toast = useToast();
  const user = useSession((s) => s.user);
  const setAddresses = useSession((s) => s.setAddresses);

  const [point, setPoint] = useState<LatLng>(initial?.point ?? DEFAULT_CENTER);
  const [label, setLabel] = useState<AddressLabel>(initial?.label ?? "ev");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [line1, setLine1] = useState(initial?.line1 ?? "");
  const [district, setDistrict] = useState(initial?.district ?? "");
  const [city, setCity] = useState(initial?.city ?? "İstanbul");
  const [buildingNo, setBuildingNo] = useState(initial?.buildingNo ?? "");
  const [floor, setFloor] = useState(initial?.floor ?? "");
  const [apartmentNo, setApartmentNo] = useState(initial?.apartmentNo ?? "");
  const [directions, setDirections] = useState(initial?.directions ?? "");
  const [contactName, setContactName] = useState(
    initial?.contactName ?? user?.name ?? ""
  );
  const [contactPhone, setContactPhone] = useState(
    initial?.contactPhone ?? user?.phone ?? ""
  );
  const [isDefault, setIsDefault] = useState(initial?.isDefault ?? true);

  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Kullanıcı elle yazdıysa otomatik doldurmayı durdur
  const touched = useRef({ line1: Boolean(initial?.line1), district: Boolean(initial?.district) });

  /* Pin durduğunda adresi çöz */
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setResolving(true);
      const result = await reverseGeocode(point, controller.signal);
      setResolving(false);
      if (!result) return;
      if (!touched.current.line1 && result.line1) setLine1(result.line1);
      if (!touched.current.district && result.district) setDistrict(result.district);
      if (result.city) setCity(result.city);
    }, 700);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [point]);

  async function useMyLocation() {
    setLocating(true);
    try {
      const pos = await currentPosition();
      touched.current = { line1: false, district: false };
      setPoint(pos);
      toast.success("Konumun bulundu.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLocating(false);
    }
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (title.trim().length < 2) next.title = "Adres başlığı gerekli (ör. Evim).";
    if (line1.trim().length < 5) next.line1 = "Açık adres en az 5 karakter olmalı.";
    if (!district.trim()) next.district = "İlçe gerekli.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      const body = {
        label,
        title: title.trim(),
        line1: line1.trim(),
        district: district.trim(),
        city: city.trim() || "İstanbul",
        buildingNo,
        floor,
        apartmentNo,
        directions,
        contactName,
        contactPhone,
        point,
        isDefault,
      };

      const data = initial
        ? await api.patch<{ address: Address; addresses: Address[] }>(
            `/addresses/${initial.id}`,
            body
          )
        : await api.post<{ address: Address; addresses: Address[] }>(
            "/addresses",
            body
          );

      setAddresses(data.addresses);
      toast.success(initial ? "Adres güncellendi." : "Adres kaydedildi.");
      onSaved(data.address, data.addresses);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {/* Harita */}
      <div className="overflow-hidden rounded-2xl border border-border">
        <PickerMap
          value={point}
          onChange={setPoint}
          className="h-56 w-full sm:h-64"
        />
        <div className="flex flex-wrap items-center gap-2 border-t border-border bg-surface-2 px-3 py-2.5">
          <button
            type="button"
            onClick={useMyLocation}
            disabled={locating}
            className="inline-flex items-center gap-1.5 rounded-lg bg-surface px-2.5 py-1.5 text-xs font-semibold text-brand transition-colors hover:bg-surface-3 disabled:opacity-60"
          >
            <Crosshair className="size-3.5" />
            {locating ? "Bulunuyor…" : "Konumumu kullan"}
          </button>
          <span className="inline-flex items-center gap-1 text-xs text-muted">
            <MapPin className="size-3.5" />
            {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
            {resolving && <span className="ml-1 animate-pulse">· çözümleniyor</span>}
          </span>
        </div>
      </div>

      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
        {QUICK_LOCATIONS.map((q) => (
          <Chip
            key={q.name}
            onClick={() => {
              touched.current = { line1: false, district: false };
              setPoint(q.point);
            }}
          >
            {q.name}
          </Chip>
        ))}
      </div>

      {/* Etiket */}
      <div className="flex gap-2">
        {ADDRESS_LABELS.map((l) => (
          <Chip
            key={l.id}
            active={label === l.id}
            onClick={() => {
              setLabel(l.id);
              if (!title.trim()) setTitle(l.name === "Ev" ? "Evim" : l.name);
            }}
          >
            <Icon name={addressLabelIcon(l.id)} className="size-4" />
            {l.name}
          </Chip>
        ))}
      </div>

      <Field label="Adres başlığı" required error={errors.title}>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Evim, Ofis, Annemler…"
          maxLength={40}
        />
      </Field>

      <Field label="Açık adres" required error={errors.line1}>
        <Textarea
          rows={2}
          value={line1}
          onChange={(e) => {
            touched.current.line1 = true;
            setLine1(e.target.value);
          }}
          placeholder="Mahalle, cadde/sokak, bina adı"
          maxLength={160}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="İlçe" required error={errors.district}>
          <Input
            value={district}
            onChange={(e) => {
              touched.current.district = true;
              setDistrict(e.target.value);
            }}
            list="sofra-districts"
            placeholder="Kadıköy"
          />
          <datalist id="sofra-districts">
            {DISTRICTS.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
        </Field>
        <Field label="İl">
          <Input value={city} onChange={(e) => setCity(e.target.value)} />
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Field label="Bina no">
          <Input value={buildingNo} onChange={(e) => setBuildingNo(e.target.value)} maxLength={10} />
        </Field>
        <Field label="Kat">
          <Input value={floor} onChange={(e) => setFloor(e.target.value)} maxLength={10} />
        </Field>
        <Field label="Daire">
          <Input value={apartmentNo} onChange={(e) => setApartmentNo(e.target.value)} maxLength={10} />
        </Field>
      </div>

      <Field label="Tarif / kapı notu" hint="Kurye için yön tarifi, kapı kodu vb.">
        <Textarea
          rows={2}
          value={directions}
          onChange={(e) => setDirections(e.target.value)}
          placeholder="Market karşısı, mavi bina. Kapı kodu 1907."
          maxLength={200}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Teslim alacak kişi">
          <Input value={contactName} onChange={(e) => setContactName(e.target.value)} />
        </Field>
        <Field label="Telefon">
          <Input
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            inputMode="tel"
            placeholder="5XX XXX XX XX"
          />
        </Field>
      </div>

      <Switch
        checked={isDefault}
        onChange={setIsDefault}
        label="Varsayılan teslimat adresim olsun"
        description="Siparişlerde otomatik olarak bu adres seçilir."
      />

      <div className="flex gap-3 pt-1">
        {onCancel && (
          <Button type="button" variant="secondary" block onClick={onCancel}>
            Vazgeç
          </Button>
        )}
        <Button type="submit" block loading={saving}>
          {initial ? "Değişiklikleri kaydet" : "Adresi kaydet"}
        </Button>
      </div>
    </form>
  );
}
