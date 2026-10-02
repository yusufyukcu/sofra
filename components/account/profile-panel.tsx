"use client";

import { Apple, Globe, Mail, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api-client";
import { useSession } from "@/lib/store/session";
import type { User } from "@/lib/types";
import { formatPhone, formatPrice } from "@/lib/utils";
import { Badge, Button, Field, Input } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";

const AVATARS = ["🧑", "👩", "🧔", "👨‍🦰", "👩‍🦱", "🧑‍🦲", "👱", "🧑‍🍳", "🦸", "🧙"];

const PROVIDER_META = {
  phone: { label: "Telefon", icon: Smartphone },
  email: { label: "E-posta", icon: Mail },
  google: { label: "Google", icon: Globe },
  apple: { label: "Apple", icon: Apple },
} as const;

/** Profil bilgileri ve bağlı giriş yöntemleri. */
export function ProfilePanel() {
  const toast = useToast();
  const user = useSession((s) => s.user);
  const setUser = useSession((s) => s.setUser);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [avatar, setAvatar] = useState("🧑");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setName(user.name);
    setEmail(user.email ?? "");
    setPhone(user.phone ?? "");
    setAvatar(user.avatarEmoji);
  }, [user]);

  if (!user) return null;

  const dirty =
    name !== user.name ||
    email !== (user.email ?? "") ||
    phone !== (user.phone ?? "") ||
    avatar !== user.avatarEmoji;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const data = await api.patch<{ user: User }>("/auth/me", {
        name,
        email: email || undefined,
        phone: phone || undefined,
        avatarEmoji: avatar,
      });
      setUser(data.user);
      toast.success("Profilin güncellendi.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">Profilim</h1>
        <p className="mt-1 text-sm text-muted">
          Hesap bilgilerini güncelle, giriş yöntemlerini gör.
        </p>
      </header>

      <form onSubmit={save} className="card space-y-5 p-5">
        <div>
          <p className="mb-2 text-sm font-semibold text-text">Avatarın</p>
          <div className="flex flex-wrap gap-2">
            {AVATARS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => setAvatar(emoji)}
                aria-label={`Avatar ${emoji}`}
                className={`flex size-11 items-center justify-center rounded-xl border text-xl transition-colors ${
                  avatar === emoji
                    ? "border-brand bg-brand-soft"
                    : "border-border bg-surface hover:bg-surface-2"
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        <Field label="Ad soyad" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Telefon" hint="Kurye seninle bu numaradan iletişime geçer.">
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              inputMode="tel"
              placeholder="5XX XXX XX XX"
            />
          </Field>
          <Field label="E-posta" hint="Fatura ve bildirimler bu adrese gönderilir.">
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="ornek@eposta.com"
            />
          </Field>
        </div>

        <Button type="submit" loading={saving} disabled={!dirty}>
          Değişiklikleri kaydet
        </Button>
      </form>

      <section className="card p-5">
        <h2 className="font-extrabold text-text">Giriş yöntemlerin</h2>
        <p className="mt-0.5 text-sm text-muted">
          Hesabına bağlı doğrulanmış yöntemler.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {user.providers.map((provider) => {
            const meta = PROVIDER_META[provider];
            return (
              <Badge key={provider} tone="success">
                <meta.icon className="size-3" />
                {meta.label}
              </Badge>
            );
          })}
        </div>
      </section>

      <section className="card grid gap-4 p-5 sm:grid-cols-3">
        <Stat label="Cüzdan bakiyesi" value={formatPrice(user.walletBalance)} />
        <Stat label="Favori restoran" value={String(user.favoriteRestaurantIds.length)} />
        <Stat
          label="Kayıtlı telefon"
          value={user.phone ? formatPhone(user.phone) : "—"}
        />
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className="mt-1 text-lg font-extrabold text-text">{value}</p>
    </div>
  );
}
