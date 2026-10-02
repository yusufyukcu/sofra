"use client";

import { X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

/**
 * Duyarlı diyalog: mobilde alttan açılan sayfa (bottom sheet),
 * masaüstünde ortalanmış pencere. Aynı bileşen ileride React Native
 * tarafında `Modal` + `BottomSheet` ile birebir eşlenebilir.
 */

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  hideClose = false,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "full";
  hideClose?: boolean;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  const widths = {
    sm: "sm:max-w-md",
    md: "sm:max-w-lg",
    lg: "sm:max-w-2xl",
    full: "sm:max-w-4xl",
  }[size];

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />

      <div
        className={cn(
          "animate-slide-up relative flex max-h-[92dvh] w-full flex-col overflow-hidden",
          "rounded-t-3xl bg-surface shadow-float sm:animate-fade-up sm:rounded-2xl",
          widths
        )}
      >
        {/* Mobil tutamaç */}
        <div className="flex justify-center pt-2.5 sm:hidden">
          <span className="h-1 w-10 rounded-full bg-border-strong" />
        </div>

        {(title || !hideClose) && (
          <div className="flex items-start gap-4 px-5 pb-3 pt-4 sm:pt-5">
            <div className="min-w-0 flex-1">
              {title && (
                <h2 className="text-lg font-bold leading-tight text-text">
                  {title}
                </h2>
              )}
              {description && (
                <p className="mt-1 text-sm text-muted">{description}</p>
              )}
            </div>
            {!hideClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Kapat"
                className="-mr-1 -mt-1 rounded-full p-2 text-muted transition-colors hover:bg-surface-2 hover:text-text"
              >
                <X className="size-5" />
              </button>
            )}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div>

        {footer && (
          <div className="safe-bottom border-t border-border bg-surface px-5 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

/** Basit onay diyaloğu. */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Onayla",
  cancelLabel = "Vazgeç",
  tone = "danger",
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "primary";
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} description={description} size="sm">
      <div className="mt-2 flex gap-3">
        <button
          type="button"
          onClick={onClose}
          className="h-11 flex-1 rounded-xl border border-border bg-surface-2 text-[15px] font-semibold text-text transition-colors hover:bg-surface-3"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={() => {
            onConfirm();
            onClose();
          }}
          className={cn(
            "h-11 flex-1 rounded-xl text-[15px] font-semibold text-white transition-opacity hover:opacity-90",
            tone === "danger" ? "bg-danger" : "bg-brand text-brand-contrast"
          )}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
