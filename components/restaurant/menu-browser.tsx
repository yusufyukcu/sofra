"use client";

import { Flame, Plus, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import type { MenuCategory, Product } from "@/lib/types";
import { cn, formatPrice } from "@/lib/utils";
import { FoodImage } from "@/components/ui/food-image";
import { Badge, EmptyState } from "@/components/ui/primitives";

/**
 * Menü gezgini: kategorilere ayrılmış ürün listesi, yapışkan kategori
 * navigasyonu (görünür bölüme göre kendini vurgular) ve menü içi arama.
 */
export function MenuBrowser({
  menu,
  onSelect,
  disabled,
  tone,
}: {
  menu: MenuCategory[];
  onSelect: (product: Product) => void;
  disabled?: boolean;
  /** Restoranin mutfagi - urun gorsellerini renklendirir */
  tone?: string;
}) {
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeId, setActiveId] = useState(menu[0]?.id ?? "");
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const navRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  /** Mobilde arama kutusu sekmelerin yerini alır; sorgu varken açık kalır. */
  const showSearch = searchOpen || query.length > 0;

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr");
    if (!q) return menu;
    return menu
      .map((category) => ({
        ...category,
        products: category.products.filter(
          (p) =>
            p.name.toLocaleLowerCase("tr").includes(q) ||
            p.description.toLocaleLowerCase("tr").includes(q)
        ),
      }))
      .filter((category) => category.products.length > 0);
  }, [menu, query]);

  /* Görünür bölümü takip et */
  useEffect(() => {
    if (query) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible?.target.id) setActiveId(visible.target.id);
      },
      { rootMargin: "-180px 0px -65% 0px", threshold: 0 }
    );

    Object.values(sectionRefs.current).forEach((el) => {
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [filtered, query]);

  /* Etkin sekmeyi görünür alana kaydır */
  useEffect(() => {
    const nav = navRef.current;
    const button = nav?.querySelector<HTMLElement>(`[data-nav="${activeId}"]`);
    if (nav && button) {
      const offset =
        button.offsetLeft - nav.offsetWidth / 2 + button.offsetWidth / 2;
      nav.scrollTo({ left: Math.max(0, offset), behavior: "smooth" });
    }
  }, [activeId]);

  function scrollToCategory(id: string) {
    const el = sectionRefs.current[id];
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 160;
    window.scrollTo({ top, behavior: "smooth" });
  }

  function toggleSearch() {
    if (showSearch) {
      setQuery("");
      setSearchOpen(false);
      return;
    }
    // Kutu görünür olsun ki odak aynı dokunuşta verilebilsin (iOS klavyesi)
    flushSync(() => setSearchOpen(true));
    searchRef.current?.focus();
  }

  return (
    <div>
      {/* Kategori navigasyonu + arama */}
      <div className="sticky top-16 z-30 -mx-4 mb-6 border-b border-border bg-bg/92 px-4 py-3 backdrop-blur lg:top-20 lg:mx-0 lg:rounded-2xl lg:border lg:px-3">
        <div className="flex items-center gap-2">
          <div
            ref={navRef}
            className={cn(
              "no-scrollbar min-w-0 flex-1 gap-1.5 overflow-x-auto",
              showSearch ? "hidden sm:flex" : "flex"
            )}
          >
            {menu.map((category) => (
              <button
                key={category.id}
                type="button"
                data-nav={category.id}
                onClick={() => scrollToCategory(category.id)}
                className={cn(
                  "shrink-0 rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
                  activeId === category.id && !query
                    ? "bg-brand text-brand-contrast"
                    : "text-muted hover:bg-surface-2 hover:text-text"
                )}
              >
                {category.name}
              </button>
            ))}
          </div>

          <label
            className={cn(
              "h-10 min-w-0 items-center gap-2 rounded-xl border border-border bg-surface px-3 focus-within:border-brand sm:flex sm:w-56 sm:flex-none",
              showSearch ? "flex flex-1" : "hidden"
            )}
          >
            <Search className="size-4 shrink-0 text-muted" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Menüde ara"
              aria-label="Menüde ara"
              className="min-w-0 flex-1 bg-transparent text-sm text-text placeholder:text-muted focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Temizle"
                className="hidden sm:block"
              >
                <X className="size-4 text-muted" />
              </button>
            )}
          </label>

          {/* Mobil: arama simgesi sekmelere yer açar */}
          <button
            type="button"
            onClick={toggleSearch}
            aria-label={showSearch ? "Aramayı kapat" : "Menüde ara"}
            aria-expanded={showSearch}
            className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-muted transition-colors hover:bg-surface-2 hover:text-text sm:hidden"
          >
            {showSearch ? <X className="size-4" /> : <Search className="size-4" />}
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          emoji="🍽️"
          title="Bu menüde sonuç yok"
          description={`"${query}" için eşleşen ürün bulamadık.`}
        />
      ) : (
        <div className="space-y-8">
          {filtered.map((category) => (
            <section
              key={category.id}
              id={category.id}
              ref={(el) => {
                sectionRefs.current[category.id] = el;
              }}
              className="scroll-mt-40"
            >
              <h2 className="font-display text-lg font-extrabold text-ink sm:text-xl">
                {category.name}
              </h2>
              {category.description && (
                <p className="mt-1 text-sm text-muted">{category.description}</p>
              )}

              <div className="mt-4 grid gap-3 sm:grid-cols-2 sm:gap-4">
                {category.products.map((product) => (
                  <ProductRow
                    key={product.id}
                    product={product}
                    onSelect={onSelect}
                    disabled={disabled}
                    tone={tone}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ProductRow({
  product,
  onSelect,
  disabled,
  tone,
}: {
  product: Product;
  onSelect: (product: Product) => void;
  disabled?: boolean;
  tone?: string;
}) {
  const unavailable = product.soldOut || disabled;

  return (
    <button
      type="button"
      onClick={() => !unavailable && onSelect(product)}
      disabled={unavailable}
      className={cn(
        "card group flex w-full items-stretch gap-4 overflow-hidden p-4 text-left transition-all",
        unavailable
          ? "opacity-60"
          : "hover:-translate-y-0.5 hover:border-border-strong hover:shadow-soft"
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-1.5">
          <h3 className="text-[15px] font-bold leading-tight text-ink">
            {product.name}
          </h3>
          {product.popular && (
            <Badge tone="accent">
              <Flame className="size-3" />
              Popüler
            </Badge>
          )}
          {product.soldOut && <Badge tone="danger">Tükendi</Badge>}
        </div>

        <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-muted">
          {product.description}
        </p>

        {/* Fiyat kartın dibine oturur — açıklama kısa da olsa hizalı kalır */}
        <div className="mt-auto flex items-center gap-2 pt-3">
          <span className="tabular text-[15px] font-extrabold text-ink">
            {formatPrice(product.price)}
          </span>
          {product.oldPrice && (
            <span className="text-sm text-muted line-through">
              {formatPrice(product.oldPrice)}
            </span>
          )}
          {product.optionGroups.length > 0 && (
            <span className="text-xs text-muted">· seçenekli</span>
          )}
        </div>
      </div>

      <div className="relative shrink-0">
        <FoodImage
          seed={product.id}
          emoji={product.emoji}
          tone={tone}
          src={product.image}
          alt={product.name}
          className="size-24 sm:size-28"
          emojiClassName="text-3xl"
          sizes="112px"
        />
        {!unavailable && (
          <span className="absolute bottom-1.5 right-1.5 flex size-8 items-center justify-center rounded-full border-2 border-surface bg-brand text-brand-contrast shadow-sm transition-transform group-hover:scale-110">
            <Plus className="size-4" strokeWidth={3} />
          </span>
        )}
      </div>
    </button>
  );
}
