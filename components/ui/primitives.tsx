"use client";

import { ChevronLeft, ChevronRight, Loader2, Minus, Plus, Star, type LucideIcon } from "lucide-react";
import type { ComponentPropsWithRef, ReactNode } from "react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Button                                                              */
/* ------------------------------------------------------------------ */

type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger"
  | "success";
type ButtonSize = "sm" | "md" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-brand text-brand-contrast hover:bg-brand-hover shadow-brand disabled:bg-brand/50 disabled:shadow-none",
  secondary: "bg-surface-2 text-ink hover:bg-surface-3 border border-border",
  outline:
    "bg-transparent text-ink border border-border-strong hover:bg-surface-2",
  ghost: "bg-transparent text-muted hover:bg-surface-2 hover:text-ink",
  danger: "bg-danger text-white hover:opacity-90",
  success: "bg-pistachio text-white hover:opacity-90",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-9 px-3.5 text-sm gap-1.5 rounded-xl",
  md: "h-11 px-4.5 text-[15px] gap-2 rounded-xl",
  lg: "h-13 px-6 text-base gap-2 rounded-2xl",
};

export interface ButtonProps extends ComponentPropsWithRef<"button"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  block?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  block = false,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center font-semibold transition-all",
        "active:scale-[0.985] disabled:opacity-60 disabled:pointer-events-none select-none",
        VARIANTS[variant],
        SIZES[size],
        block && "w-full",
        className
      )}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Badge & Chip                                                        */
/* ------------------------------------------------------------------ */

type Tone = "neutral" | "brand" | "success" | "danger" | "accent" | "info";

const TONES: Record<Tone, string> = {
  neutral: "bg-surface-2 text-muted border-border",
  brand: "bg-brand-soft text-brand border-transparent",
  success: "bg-success-soft text-success border-transparent",
  danger: "bg-danger-soft text-danger border-transparent",
  accent: "bg-accent-soft text-accent border-transparent",
  info: "bg-info-soft text-info border-transparent",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold",
        TONES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function Chip({
  active,
  children,
  onClick,
  className,
  title,
}: {
  active?: boolean;
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors",
        active
          ? "border-brand bg-brand text-brand-contrast"
          : "border-border bg-surface text-ink hover:border-border-strong hover:bg-surface-2",
        className
      )}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Kaydırma oku                                                        */
/* ------------------------------------------------------------------ */

/**
 * Yatay rayların masaüstü oku. Dokunmatik ekranda ray parmakla kaydırılır;
 * ok yalnızca `lg` ve üstünde, gidilecek yer varken görünür.
 */
export function ScrollArrow({
  direction,
  visible,
  onClick,
  label,
  className,
}: {
  direction: "prev" | "next";
  visible: boolean;
  onClick: () => void;
  label: string;
  className?: string;
}) {
  const Icon = direction === "prev" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      className={cn(
        "absolute z-10 hidden size-9 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface text-ink shadow-soft transition-opacity hover:bg-surface-2 lg:flex",
        direction === "prev" ? "-left-4" : "-right-4",
        !visible && "pointer-events-none opacity-0",
        className ?? "top-1/2"
      )}
    >
      <Icon className="size-5" />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Yıldız puanı                                                        */
/* ------------------------------------------------------------------ */

export function Stars({
  value,
  size = 14,
  className,
}: {
  value: number;
  size?: number;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-label={`${value} / 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          width={size}
          height={size}
          className={
            i <= Math.round(value)
              ? "fill-accent text-accent"
              : "text-border-strong"
          }
          aria-hidden
        />
      ))}
    </span>
  );
}

export function StarPicker({
  value,
  onChange,
  size = 32,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  size?: number;
  label?: string;
}) {
  return (
    <div className="inline-flex items-center gap-1" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          role="radio"
          aria-checked={value === i}
          aria-label={`${i} yıldız`}
          onClick={() => onChange(i)}
          className="rounded-lg p-1 transition-transform hover:scale-110 active:scale-95"
        >
          <Star
            width={size}
            height={size}
            className={
              i <= value ? "fill-accent text-accent" : "text-border-strong"
            }
          />
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Form alanları                                                       */
/* ------------------------------------------------------------------ */

const FIELD_BASE =
  "w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-[15px] text-text placeholder:text-muted/70 transition-colors focus:border-brand focus:outline-none disabled:opacity-60";

export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
}: {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block space-y-1.5", className)}>
      {label && (
        <span className="block text-sm font-semibold text-ink">
          {label}
          {required && <span className="ml-0.5 text-brand">*</span>}
        </span>
      )}
      {children}
      {error ? (
        <span className="block text-xs font-medium text-danger">{error}</span>
      ) : hint ? (
        <span className="block text-xs text-muted">{hint}</span>
      ) : null}
    </label>
  );
}

export function Input({ className, ...rest }: ComponentPropsWithRef<"input">) {
  return <input {...rest} className={cn(FIELD_BASE, className)} />;
}

export function Textarea({
  className,
  ...rest
}: ComponentPropsWithRef<"textarea">) {
  return (
    <textarea {...rest} className={cn(FIELD_BASE, "resize-none", className)} />
  );
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  icon,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface p-3.5 text-left transition-colors hover:bg-surface-2"
    >
      {icon && <span className="text-muted">{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-text">{label}</span>
        {description && (
          <span className="mt-0.5 block text-xs text-muted">{description}</span>
        )}
      </span>
      <span
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors",
          checked ? "bg-brand" : "bg-surface-3"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-5 rounded-full bg-white shadow-sm transition-all",
            checked ? "left-[22px]" : "left-0.5"
          )}
        />
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Adet sayacı                                                         */
/* ------------------------------------------------------------------ */

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 30,
  size = "md",
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  size?: "sm" | "md";
}) {
  const dim = size === "sm" ? "size-8 text-sm" : "size-10";
  return (
    <div className="inline-flex items-center rounded-xl border border-border bg-surface">
      <button
        type="button"
        aria-label="Azalt"
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
        className={cn(
          dim,
          "flex items-center justify-center rounded-l-xl font-bold text-brand transition-colors hover:bg-surface-2 disabled:text-muted/50"
        )}
      >
        <Minus className={size === "sm" ? "size-4" : "size-[18px]"} strokeWidth={2.6} aria-hidden />
      </button>
      <span
        className={cn(
          "min-w-8 text-center font-bold tabular-nums",
          size === "sm" ? "text-sm" : "text-base"
        )}
      >
        {value}
      </span>
      <button
        type="button"
        aria-label="Artır"
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
        className={cn(
          dim,
          "flex items-center justify-center rounded-r-xl font-bold text-brand transition-colors hover:bg-surface-2 disabled:text-muted/50"
        )}
      >
        <Plus className={size === "sm" ? "size-4" : "size-[18px]"} strokeWidth={2.6} aria-hidden />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Boş durum & iskelet                                                 */
/* ------------------------------------------------------------------ */

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface/60 px-6 py-14 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-brand-soft text-brand" aria-hidden>
        <Icon className="size-7" strokeWidth={1.9} />
      </span>
      <h3 className="font-display mt-4 text-lg font-extrabold text-ink">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm text-muted">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-xl", className)} />;
}

/* ------------------------------------------------------------------ */
/* Bölüm başlığı                                                       */
/* ------------------------------------------------------------------ */

export function SectionHeading({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <h2 className="font-display text-xl font-extrabold text-ink sm:text-2xl">
          {title}
        </h2>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
