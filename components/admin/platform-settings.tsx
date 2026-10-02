"use client";

import { FlaskConical } from "lucide-react";
import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api-client";
import type { AppSettings } from "@/lib/db/settings";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";

const SPEEDS = [1, 6, 12, 30];

/**
 * Demo modu anahtarı (canlı operasyon ekranının üstünde).
 *
 * Açıkken: vardiyada kurye yoksa teslimatı simülasyon üstlenir, süreler
 * seçilen kat hızlı akar, müşteri "demo ile giriş" yapabilir.
 * Kapalıyken: siparişler yalnızca gerçek kuryelerle, gerçek sürede ilerler.
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
          ? `Demo modu açık · süreler ${data.settings.simSpeed}× hızlı`
          : "Demo modu kapalı · yalnızca gerçek kuryeler, gerçek süreler"
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
        Demo modu
      </label>
      {settings.demoMode && (
        <div className="flex gap-1" role="group" aria-label="Simülasyon hızı">
          {SPEEDS.map((speed) => (
            <button
              key={speed}
              type="button"
              disabled={busy}
              onClick={() => void update({ simSpeed: speed })}
              className={cn(
                "tabular rounded-lg px-2 py-1 text-xs font-bold transition-colors",
                settings.simSpeed === speed ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
              )}
            >
              {speed}×
            </button>
          ))}
        </div>
      )}
      <span className="w-full text-[11px] leading-snug text-muted sm:w-auto sm:max-w-64">
        {settings.demoMode
          ? "Kurye yokken siparişler simülasyonla ilerler; demo girişi açık."
          : "Siparişler yalnızca gerçek kuryelerle, gerçek sürede ilerler."}
      </span>
    </div>
  );
}
