"use client";

import { ArrowUpDown, Check, ChevronDown, SlidersHorizontal } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { CATEGORIES, SORT_OPTIONS } from "@/lib/constants";
import {
  DEFAULT_FILTERS,
  activeFilterCount,
  type DiscoveryFilters,
} from "@/lib/discovery";
import { useScrollEdges } from "@/lib/hooks";
import type { CategoryId, SortKey } from "@/lib/types";
import { cn } from "@/lib/utils";
import { cuisineIcon } from "@sofra/core";
import { FoodImage } from "@/components/ui/food-image";
import { Icon } from "@/components/ui/icon";
import { Modal } from "@/components/ui/modal";
import { Button, Chip, ScrollArrow, Switch } from "@/components/ui/primitives";

/* ------------------------------------------------------------------ */
/* Kategori rayı                                                       */
/* ------------------------------------------------------------------ */

export function CategoryRail({
  value,
  onChange,
  counts,
}: {
  value: CategoryId;
  onChange: (id: CategoryId) => void;
  counts: Record<string, number>;
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const edges = useScrollEdges(railRef);

  function page(direction: -1 | 1) {
    const rail = railRef.current;
    rail?.scrollBy({ left: direction * rail.clientWidth * 0.8, behavior: "smooth" });
  }

  return (
    <div className="relative">
      {/* Dikey 4px boşluk, seçili kutunun halkası kırpılmasın diye */}
      <div
        ref={railRef}
        className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 py-1 lg:-mx-1 lg:gap-4 lg:px-1"
        role="tablist"
        aria-label="Mutfak kategorileri"
      >
        {CATEGORIES.map((category) => {
          const active = value === category.id;
          const count = counts[category.id] ?? 0;
          if (count === 0 && category.id !== "all" && !active) return null;

          const generic = category.id === "all" || category.id === "top-rated";

          return (
            <button
              key={category.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(category.id)}
              className="group flex w-[4.75rem] shrink-0 flex-col items-center gap-2"
            >
              <span
                className={cn(
                  "relative block size-[4.75rem] overflow-hidden rounded-2xl transition-all",
                  active
                    ? "ring-2 ring-brand ring-offset-2 ring-offset-paper"
                    : "ring-1 ring-border group-hover:ring-border-strong"
                )}
              >
                {generic ? (
                  <span
                    className={cn(
                      "flex size-full items-center justify-center transition-colors",
                      active ? "bg-brand text-brand-contrast" : "bg-brand-soft text-brand"
                    )}
                  >
                    <Icon name={cuisineIcon(category.id)} className="size-7" strokeWidth={1.9} />
                  </span>
                ) : (
                  <FoodImage
                    seed={category.id}
                    tone={category.id}
                    src={category.image}
                    rounded="rounded-none"
                    className="size-full"
                    iconClassName="size-6"
                    zoom
                    sizes="76px"
                  />
                )}
              </span>
              <span
                className={cn(
                  "text-center text-[11px] font-semibold leading-tight",
                  active ? "text-brand" : "text-text"
                )}
              >
                {category.name}
              </span>
            </button>
          );
        })}
      </div>

      {/* Okların dikey merkezi kutunun ortası: 4px boşluk + 38px */}
      <ScrollArrow
        direction="prev"
        visible={edges.start}
        onClick={() => page(-1)}
        label="Önceki mutfaklar"
        className="top-[2.625rem]"
      />
      <ScrollArrow
        direction="next"
        visible={edges.end}
        onClick={() => page(1)}
        label="Sonraki mutfaklar"
        className="top-[2.625rem]"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Seçenekler                                                          */
/* ------------------------------------------------------------------ */

const RATING_OPTIONS = [0, 3.5, 4, 4.5];
const ETA_OPTIONS = [0, 30, 45, 60];
const BASKET_OPTIONS = [0, 200, 300, 500];

const decimal = (v: number) => v.toString().replace(".", ",");

/** Tek dokunuşla açılıp kapanan sık kullanılan filtreler (mobil çubuk). */
const QUICK_FILTERS: {
  label: string;
  active: (f: DiscoveryFilters) => boolean;
  toggle: (f: DiscoveryFilters) => DiscoveryFilters;
}[] = [
  {
    label: "Şu an açık",
    active: (f) => f.openOnly,
    toggle: (f) => ({ ...f, openOnly: !f.openOnly }),
  },
  {
    label: "Ücretsiz teslimat fırsatı",
    active: (f) => f.freeDeliveryOnly,
    toggle: (f) => ({ ...f, freeDeliveryOnly: !f.freeDeliveryOnly }),
  },
  {
    label: "4,5+ puan",
    active: (f) => f.minRating === 4.5,
    toggle: (f) => ({ ...f, minRating: f.minRating === 4.5 ? 0 : 4.5 }),
  },
  {
    label: "En fazla 30 dk",
    active: (f) => f.maxEta === 30,
    toggle: (f) => ({ ...f, maxEta: f.maxEta === 30 ? 0 : 30 }),
  },
];

function SortSelect({
  value,
  onChange,
}: {
  value: SortKey;
  onChange: (sort: SortKey) => void;
}) {
  return (
    <div className="relative shrink-0">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as SortKey)}
        aria-label="Sıralama"
        className="h-10 appearance-none rounded-xl border border-border bg-surface pl-9 pr-9 text-sm font-semibold text-text focus:border-brand focus:outline-none"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      <ArrowUpDown className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Mobil / tablet: yapışkan sıralama + filtre çubuğu                   */
/* ------------------------------------------------------------------ */

export function FilterBar({
  filters,
  onChange,
  resultCount,
}: {
  filters: DiscoveryFilters;
  onChange: (next: DiscoveryFilters) => void;
  resultCount: number;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const activeCount = activeFilterCount(filters);

  return (
    <>
      <div className="no-scrollbar -mx-4 flex items-center gap-2 overflow-x-auto px-4">
        <SortSelect
          value={filters.sort}
          onChange={(sort) => onChange({ ...filters, sort })}
        />

        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className={cn(
            "inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border px-3.5 text-sm font-semibold transition-colors",
            activeCount
              ? "border-brand bg-brand-soft text-brand"
              : "border-border bg-surface text-text hover:bg-surface-2"
          )}
        >
          <SlidersHorizontal className="size-4" />
          Filtrele
          {activeCount > 0 && (
            <span className="flex size-5 items-center justify-center rounded-full bg-brand text-[11px] font-extrabold text-brand-contrast">
              {activeCount}
            </span>
          )}
        </button>

        <span aria-hidden className="mx-1 h-6 w-px shrink-0 bg-border" />

        {QUICK_FILTERS.map((quick) => (
          <Chip
            key={quick.label}
            active={quick.active(filters)}
            onClick={() => onChange(quick.toggle(filters))}
            className="h-10"
          >
            {quick.label}
          </Chip>
        ))}
      </div>

      <FilterSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        filters={filters}
        onChange={onChange}
        resultCount={resultCount}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Masaüstü: yan panel                                                 */
/* ------------------------------------------------------------------ */

/**
 * Masaüstünde filtreler pencereye saklanmaz, listenin solunda sabit durur:
 * her değişiklik sonucu anında gösterir, kullanıcı ne seçtiğini görür.
 */
export function FilterPanel({
  filters,
  onChange,
}: {
  filters: DiscoveryFilters;
  onChange: (next: DiscoveryFilters) => void;
}) {
  const dirty =
    activeFilterCount(filters) > 0 || filters.sort !== DEFAULT_FILTERS.sort;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-xl font-extrabold text-ink sm:text-2xl">
          Filtrele
        </h2>
        {dirty && (
          <button
            type="button"
            onClick={() =>
              onChange({
                ...DEFAULT_FILTERS,
                category: filters.category,
                query: filters.query,
              })
            }
            className="text-sm font-semibold text-brand hover:underline"
          >
            Temizle
          </button>
        )}
      </div>

      <div className="card divide-y divide-border px-5 py-1">
        <PanelGroup title="Sıralama">
          <div role="radiogroup" aria-label="Sıralama">
            {SORT_OPTIONS.map((option) => {
              const checked = filters.sort === option.id;
              return (
                <label
                  key={option.id}
                  className="flex cursor-pointer items-center gap-3 py-1 text-sm"
                >
                  <input
                    type="radio"
                    name="discovery-sort"
                    value={option.id}
                    checked={checked}
                    onChange={() => onChange({ ...filters, sort: option.id })}
                    className="size-4 shrink-0 cursor-pointer appearance-none rounded-full border-2 border-border-strong transition-[border-width,border-color] checked:border-[5px] checked:border-brand"
                  />
                  <span className={checked ? "font-semibold text-ink" : "text-text"}>
                    {option.label}
                  </span>
                </label>
              );
            })}
          </div>
        </PanelGroup>

        <PanelGroup title="Minimum puan">
          <Segmented
            label="Minimum puan"
            options={RATING_OPTIONS}
            value={filters.minRating}
            onChange={(v) => onChange({ ...filters, minRating: v })}
            format={(v) => (v === 0 ? "Tümü" : `${decimal(v)}+`)}
          />
        </PanelGroup>

        <PanelGroup title="En fazla teslimat süresi">
          <Segmented
            label="En fazla teslimat süresi"
            options={ETA_OPTIONS}
            value={filters.maxEta}
            onChange={(v) => onChange({ ...filters, maxEta: v })}
            format={(v) => (v === 0 ? "Tümü" : `${v} dk`)}
          />
        </PanelGroup>

        <PanelGroup title="Minimum sepet tutarı">
          <Segmented
            label="Minimum sepet tutarı"
            options={BASKET_OPTIONS}
            value={filters.maxMinBasket}
            onChange={(v) => onChange({ ...filters, maxMinBasket: v })}
            format={(v) => (v === 0 ? "Tümü" : `≤ ${v} ₺`)}
          />
        </PanelGroup>

        <PanelGroup title="Tercihler">
          <CheckRow
            checked={filters.openOnly}
            onChange={(v) => onChange({ ...filters, openOnly: v })}
            label="Şu an açık olanlar"
          />
          <CheckRow
            checked={filters.freeDeliveryOnly}
            onChange={(v) => onChange({ ...filters, freeDeliveryOnly: v })}
            label="Ücretsiz teslimat fırsatı"
          />
          <CheckRow
            checked={!filters.deliverableOnly}
            onChange={(v) => onChange({ ...filters, deliverableOnly: !v })}
            label="Bölge dışındakileri de göster"
          />
        </PanelGroup>
      </div>
    </div>
  );
}

function PanelGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="py-4">
      <h3 className="mb-2 text-sm font-bold text-ink">{title}</h3>
      {children}
    </section>
  );
}

/** Siparişlerim sekmeleriyle aynı dilde dörtlü seçim — tek satıra sığar. */
function Segmented({
  label,
  options,
  value,
  onChange,
  format,
}: {
  label: string;
  options: number[];
  value: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
}) {
  return (
    <div role="group" aria-label={label} className="flex gap-1 rounded-xl bg-surface-2 p-1">
      {options.map((option) => {
        const active = value === option;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option)}
            className={cn(
              "tabular min-w-0 flex-1 whitespace-nowrap rounded-lg py-1.5 text-xs font-semibold transition-colors",
              active
                ? "bg-surface text-ink shadow-sm"
                : "text-muted hover:text-text"
            )}
          >
            {format(option)}
          </button>
        );
      })}
    </div>
  );
}

function CheckRow({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 py-1.5 text-sm text-text">
      <span className="relative flex size-4 shrink-0 items-center justify-center">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer absolute inset-0 cursor-pointer appearance-none rounded-[5px] border-2 border-border-strong transition-colors checked:border-brand checked:bg-brand"
        />
        <Check
          aria-hidden
          strokeWidth={3.5}
          className="pointer-events-none relative size-3 text-brand-contrast opacity-0 peer-checked:opacity-100"
        />
      </span>
      <span className="leading-snug">{label}</span>
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* Filtre sayfası (mobil)                                              */
/* ------------------------------------------------------------------ */

function OptionRow({
  label,
  options,
  value,
  onChange,
  format,
}: {
  label: string;
  options: number[];
  value: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
}) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-bold text-text">{label}</h3>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <Chip
            key={option}
            active={value === option}
            onClick={() => onChange(option)}
          >
            {format(option)}
          </Chip>
        ))}
      </div>
    </div>
  );
}

function FilterSheet({
  open,
  onClose,
  filters,
  onChange,
  resultCount,
}: {
  open: boolean;
  onClose: () => void;
  filters: DiscoveryFilters;
  onChange: (next: DiscoveryFilters) => void;
  resultCount: number;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Filtrele"
      description="Sana uygun restoranları daralt."
      size="md"
      footer={
        <div className="flex gap-3">
          <Button
            variant="secondary"
            block
            onClick={() =>
              onChange({
                ...DEFAULT_FILTERS,
                category: filters.category,
                query: filters.query,
                sort: filters.sort,
              })
            }
          >
            Temizle
          </Button>
          <Button block onClick={onClose}>
            {resultCount} restoranı göster
          </Button>
        </div>
      }
    >
      <div className="space-y-6 pt-2">
        <OptionRow
          label="Minimum puan"
          options={RATING_OPTIONS}
          value={filters.minRating}
          onChange={(v) => onChange({ ...filters, minRating: v })}
          format={(v) => (v === 0 ? "Tümü" : `${decimal(v)} ve üzeri`)}
        />

        <OptionRow
          label="En fazla teslimat süresi"
          options={ETA_OPTIONS}
          value={filters.maxEta}
          onChange={(v) => onChange({ ...filters, maxEta: v })}
          format={(v) => (v === 0 ? "Fark etmez" : `${v} dk`)}
        />

        <OptionRow
          label="Minimum sepet tutarı"
          options={BASKET_OPTIONS}
          value={filters.maxMinBasket}
          onChange={(v) => onChange({ ...filters, maxMinBasket: v })}
          format={(v) => (v === 0 ? "Fark etmez" : `${v} ₺ altı`)}
        />

        <div className="space-y-2">
          <Switch
            checked={filters.openOnly}
            onChange={(v) => onChange({ ...filters, openOnly: v })}
            label="Sadece şu an açık olanlar"
            description="Kapalı restoranları listeden gizler."
          />
          <Switch
            checked={filters.freeDeliveryOnly}
            onChange={(v) => onChange({ ...filters, freeDeliveryOnly: v })}
            label="Ücretsiz teslimat fırsatı olanlar"
            description="Belirli tutar üzeri teslimat ücreti almayan restoranlar."
          />
          <Switch
            checked={!filters.deliverableOnly}
            onChange={(v) => onChange({ ...filters, deliverableOnly: !v })}
            label="Adresime teslimat yapmayanları da göster"
            description="Teslimat bölgesi dışındaki restoranlar gri görünür."
          />
        </div>
      </div>
    </Modal>
  );
}
