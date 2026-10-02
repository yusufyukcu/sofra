"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

/** Kopyalanabilir kampanya kodu rozeti. */
export function CouponCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch {
          /* pano erişimi yoksa sessizce geç */
        }
      }}
      className="mt-auto flex items-center justify-between gap-3 rounded-xl border border-dashed border-border-strong bg-surface-2 px-4 py-2.5 transition-colors hover:border-brand"
    >
      <span className="font-mono text-base font-extrabold tracking-wider text-brand">
        {code}
      </span>
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted">
        {copied ? (
          <>
            <Check className="size-3.5 text-success" />
            Kopyalandı
          </>
        ) : (
          <>
            <Copy className="size-3.5" />
            Kopyala
          </>
        )}
      </span>
    </button>
  );
}
