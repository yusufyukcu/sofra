"use client";

import { FlaskConical } from "lucide-react";
import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api-client";
import type { AppSettings } from "@/lib/db/settings";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";

/**
 * Demo girişleri (sunum) anahtarı — canlı operasyon ekranının üstünde.
 * Gerçek işletmede kapalı kalır; açıkken giriş ekranlarında hazır demo
 * hesapları görünür. Teslimat her durumda gerçek kuryelerle, gerçek
 * sürede ilerler: simülasyon yok.
 */
export function PlatformSettings({ onChanged }: { onChanged?: () => void }) {
  const toast = useToast();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get<{ settings: AppSettings }>("/admin/settings")
      .then((data) => setSettings(data.settings))
      .catch(() => undefined);
  }, []);

  async function update(patch: Partial<AppSettings>) {
    setBusy(true);
    try {
      const data = await api.patch<{ settings: AppSettings }>("/admin/settings", patch);
      setSettings(data.settings);
      toast.success(
        data.settings.demoMode
          ? "Demo girişleri açık · giriş ekranlarında hazır hesaplar görünür"
          : "Demo girişleri kapalı"
      );
      onChanged?.();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (!settings) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-2xl border px-3.5 py-2.5",
        settings.demoMode ? "border-saffron/40 bg-saffron-soft" : "border-border bg-surface"
      )}
    >
      <FlaskConical className={cn("size-4", settings.demoMode ? "text-saffron" : "text-muted")} />
      <label className="flex items-center gap-2 text-sm font-semibold text-ink">
        <input
          type="checkbox"
          checked={settings.demoMode}
          disabled={busy}
          onChange={(e) => void update({ demoMode: e.target.checked })}
          className="size-4 accent-[var(--brand)]"
        />
        Demo girişleri (sunum)
      </label>
      <span className="w-full text-[11px] leading-snug text-muted sm:w-auto sm:max-w-64">
        {settings.demoMode
          ? "Giriş ekranlarında hazır demo hesapları görünür. Teslimatı yine gerçek kuryeler yapar."
          : "Teslimatı yalnızca mesaideki kuryeler üstlenir; konumları cihazlarından canlı gelir."}
      </span>
    </div>
  );
}
