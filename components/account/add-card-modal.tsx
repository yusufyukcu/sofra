"use client";

import { CreditCard, FlaskConical } from "lucide-react";
import { useState } from "react";
import { api, errorMessage } from "@/lib/api-client";
import { TEST_PAYMENT_CARDS } from "@/lib/constants";
import { useSession } from "@/lib/store/session";
import type { SavedCard } from "@/lib/types";
import { cardBrandOf, cn, formatCardNumber, luhnValid } from "@/lib/utils";
import { Modal } from "@/components/ui/modal";
import { Button, Field, Input } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";

const BRAND_LABEL = { visa: "Visa", mastercard: "Mastercard", troy: "Troy" } as const;

/** "1229" → "12/29" (yazarken) */
function formatExpiry(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
}

/**
 * Kart ekleme penceresi (ödeme simülasyonu).
 *
 * Gerçek ödeme kuruluşu bağlanana kadar yalnızca test kartları kabul
 * edilir; kart numarası ve güvenlik kodu sunucuda saklanmaz. Test kartı
 * çiplerinden biri seçilince form doldurulur.
 */
export function AddCardModal({
  open,
  onClose,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  /** Güncel kart listesi ve yeni eklenen kart */
  onAdded?: (cards: SavedCard[], added: SavedCard | undefined) => void;
}) {
  const toast = useToast();
  const user = useSession((s) => s.user);
  const cards = useSession((s) => s.cards);
  const setCards = useSession((s) => s.setCards);

  const [number, setNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [holder, setHolder] = useState(user?.name ?? "");
  const [nickname, setNickname] = useState("");
  const [busy, setBusy] = useState(false);

  const digits = number.replace(/\D/g, "");
  const brand = cardBrandOf(digits);
  const numberError = digits.length >= 13 && !luhnValid(digits) ? "Kart numarası hatalı görünüyor." : undefined;
  const ready = luhnValid(digits) && brand && /^\d{2}\/\d{2}$/.test(expiry) && /^\d{3,4}$/.test(cvc) && holder.trim().length >= 3;

  function fillTest(card: (typeof TEST_PAYMENT_CARDS)[number]) {
    setNumber(formatCardNumber(card.number));
    setExpiry("12/30");
    setCvc("123");
    if (!holder.trim()) setHolder(user?.name ?? "Test Kullanıcı");
    if (!nickname) setNickname(card.outcome === "decline" ? "Reddedilen test kartı" : `${card.label} test`);
  }

  async function submit() {
    setBusy(true);
    try {
      const before = new Set(cards.map((c) => c.id));
      const data = await api.post<{ cards: SavedCard[] }>("/cards", {
        number: digits,
        expiry,
        cvc,
        holder,
        nickname,
      });
      setCards(data.cards);
      const added = data.cards.find((c) => !before.has(c.id));
      toast.success("Kart kaydedildi.");
      onAdded?.(data.cards, added);
      setNumber("");
      setCvc("");
      setNickname("");
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Kart ekle"
      description="Kart numaran ve güvenlik kodun saklanmaz; yalnızca son 4 hane görünür."
      size="sm"
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" block onClick={onClose}>
            Vazgeç
          </Button>
          <Button block loading={busy} disabled={!ready} onClick={submit}>
            Kartı kaydet
          </Button>
        </div>
      }
    >
      <div className="space-y-4 pt-1">
        <div className="rounded-xl border border-saffron/40 bg-saffron-soft p-3">
          <p className="flex items-center gap-1.5 text-xs font-bold text-saffron">
            <FlaskConical className="size-3.5" />
            Ödeme simülasyonu — gerçek kart bilgisi girme
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {TEST_PAYMENT_CARDS.map((card) => (
              <button
                key={card.number}
                type="button"
                onClick={() => fillTest(card)}
                className={cn(
                  "rounded-lg border px-2 py-1 text-[11px] font-semibold transition-colors",
                  card.outcome === "decline"
                    ? "border-danger/40 bg-surface text-danger hover:bg-danger-soft"
                    : "border-border bg-surface text-ink hover:bg-surface-2"
                )}
              >
                {card.label}
              </button>
            ))}
          </div>
        </div>

        <Field label="Kart numarası" error={numberError}>
          <div className="relative">
            <Input
              inputMode="numeric"
              autoComplete="off"
              value={number}
              onChange={(e) => setNumber(formatCardNumber(e.target.value))}
              placeholder="4242 4242 4242 4242"
              className="tabular pr-24"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1 text-xs font-bold text-muted">
              <CreditCard className="size-4" />
              {brand ? BRAND_LABEL[brand] : ""}
            </span>
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Son kullanma (AA/YY)">
            <Input
              inputMode="numeric"
              autoComplete="off"
              value={expiry}
              onChange={(e) => setExpiry(formatExpiry(e.target.value))}
              placeholder="12/30"
              className="tabular"
            />
          </Field>
          <Field label="Güvenlik kodu">
            <Input
              inputMode="numeric"
              autoComplete="off"
              value={cvc}
              onChange={(e) => setCvc(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="123"
              className="tabular"
            />
          </Field>
        </div>

        <Field label="Kart üzerindeki ad">
          <Input value={holder} onChange={(e) => setHolder(e.target.value)} maxLength={60} />
        </Field>
        <Field label="Kart adı (isteğe bağlı)" hint="Ör. İş kartım">
          <Input value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={30} />
        </Field>
      </div>
    </Modal>
  );
}
