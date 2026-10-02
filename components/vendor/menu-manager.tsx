"use client";

import {
  ChevronDown,
  ChevronUp,
  Clock,
  Layers,
  Pencil,
  Plus,
  Search,
  Trash2,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, errorMessage } from "@/lib/api-client";
import type { MediaRequest, MenuCategory, Product } from "@/lib/types";
import { cn, formatPrice } from "@/lib/utils";
import { FoodImage } from "@/components/ui/food-image";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import {
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  Skeleton,
  Textarea,
} from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { latestFor } from "./photo-request";
import { ProductEditor } from "./product-editor";

/**
 * Menü ve stok yönetimi.
 *
 * Kategori sırası müşteri menüsündeki sırayı belirler. Stok anahtarı
 * kaydet düğmesi beklemeden anında etki eder — mutfakta bir ürün
 * tükendiğinde tek dokunuşla kapatılabilsin diye.
 */
export function MenuManager() {
  const toast = useToast();
  const [menu, setMenu] = useState<MenuCategory[] | null>(null);
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);

  const [categoryModal, setCategoryModal] = useState<MenuCategory | "new" | null>(
    null
  );
  const [productModal, setProductModal] = useState<{
    product: Product | null;
    categoryId: string;
  } | null>(null);
  const [deleting, setDeleting] = useState<
    { kind: "category" | "product"; id: string; name: string } | null
  >(null);
  /** Fotoğraf talepleri — ürün satırında onay durumu rozeti olarak görünür */
  const [requests, setRequests] = useState<MediaRequest[]>([]);

  const loadRequests = useCallback(() => {
    api
      .get<{ requests: MediaRequest[] }>("/vendor/media")
      .then((data) => setRequests(data.requests))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    api
      .get<{ menu: MenuCategory[] }>("/vendor/menu")
      .then((data) => setMenu(data.menu))
      .catch((err) => {
        toast.error(errorMessage(err));
        setMenu([]);
      });
    loadRequests();
  }, [toast, loadRequests]);

  async function categoryAction(body: Record<string, unknown>) {
    try {
      const data = await api.post<{ menu: MenuCategory[] }>(
        "/vendor/menu/categories",
        body
      );
      setMenu(data.menu);
      return true;
    } catch (err) {
      toast.error(errorMessage(err));
      return false;
    }
  }

  async function productAction(body: Record<string, unknown>) {
    try {
      const data = await api.post<{ menu: MenuCategory[] }>(
        "/vendor/menu/products",
        body
      );
      setMenu(data.menu);
      return true;
    } catch (err) {
      toast.error(errorMessage(err));
      return false;
    }
  }

  const filtered = useMemo(() => {
    if (!menu) return [];
    const q = query.trim().toLocaleLowerCase("tr");
    if (!q) return menu;
    return menu
      .map((category) => ({
        ...category,
        products: category.products.filter((p) =>
          p.name.toLocaleLowerCase("tr").includes(q)
        ),
      }))
      .filter(
        (category) =>
          category.products.length > 0 ||
          category.name.toLocaleLowerCase("tr").includes(q)
      );
  }, [menu, query]);

  if (!menu) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const productCount = menu.reduce((sum, c) => sum + c.products.length, 0);
  const soldOutCount = menu.reduce(
    (sum, c) => sum + c.products.filter((p) => p.soldOut).length,
    0
  );
  const pendingPhotos = requests.filter(
    (r) => r.status === "pending" && r.target.kind === "product"
  ).length;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-ink">
            Menü &amp; Stok
          </h1>
          <p className="tabular mt-0.5 text-sm text-muted">
            {menu.length} kategori · {productCount} ürün
            {soldOutCount > 0 && (
              <span className="text-danger"> · {soldOutCount} tükendi</span>
            )}
            {pendingPhotos > 0 && (
              <span className="text-saffron">
                {" "}
                · {pendingPhotos} fotoğraf onay bekliyor
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setCategoryModal("new")}>
            <Layers className="size-4" />
            Kategori ekle
          </Button>
          <Button
            onClick={() =>
              setProductModal({
                product: null,
                categoryId: menu[0]?.id ?? "",
              })
            }
            disabled={menu.length === 0}
          >
            <Plus className="size-4" />
            Ürün ekle
          </Button>
        </div>
      </header>

      <label className="flex h-11 max-w-sm items-center gap-2 rounded-xl border border-border bg-surface px-3 focus-within:border-brand">
        <Search className="size-4 shrink-0 text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Menüde ara"
          aria-label="Menüde ara"
          className="min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-muted focus:outline-none"
        />
      </label>

      {menu.length === 0 ? (
        <EmptyState
          emoji="📋"
          title="Menün boş"
          description="Önce bir kategori oluştur, sonra ürünlerini ekle."
          action={
            <Button onClick={() => setCategoryModal("new")}>Kategori ekle</Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {filtered.map((category, index) => {
            const isCollapsed = collapsed.has(category.id);
            return (
              <section key={category.id} className="card overflow-hidden">
                <header className="flex flex-wrap items-center gap-2 border-b border-border bg-surface-2/60 px-4 py-3">
                  <button
                    type="button"
                    onClick={() =>
                      setCollapsed((current) => {
                        const next = new Set(current);
                        if (next.has(category.id)) next.delete(category.id);
                        else next.add(category.id);
                        return next;
                      })
                    }
                    className="flex min-w-0 items-center gap-2 text-left"
                  >
                    <ChevronDown
                      className={cn(
                        "size-4 shrink-0 text-muted transition-transform",
                        isCollapsed && "-rotate-90"
                      )}
                    />
                    <span className="font-display truncate text-base font-extrabold text-ink">
                      {category.name}
                    </span>
                    <span className="tabular shrink-0 rounded-md bg-surface px-1.5 py-0.5 text-xs font-bold text-muted">
                      {category.products.length}
                    </span>
                  </button>

                  <div className="ml-auto flex items-center gap-1">
                    <IconButton
                      label="Yukarı taşı"
                      disabled={index === 0 || Boolean(query)}
                      onClick={() =>
                        categoryAction({
                          action: "move",
                          id: category.id,
                          direction: "up",
                        })
                      }
                    >
                      <ChevronUp className="size-4" />
                    </IconButton>
                    <IconButton
                      label="Aşağı taşı"
                      disabled={index === filtered.length - 1 || Boolean(query)}
                      onClick={() =>
                        categoryAction({
                          action: "move",
                          id: category.id,
                          direction: "down",
                        })
                      }
                    >
                      <ChevronDown className="size-4" />
                    </IconButton>
                    <IconButton
                      label="Kategoriyi düzenle"
                      onClick={() => setCategoryModal(category)}
                    >
                      <Pencil className="size-4" />
                    </IconButton>
                    <IconButton
                      label="Kategoriyi sil"
                      danger
                      onClick={() =>
                        setDeleting({
                          kind: "category",
                          id: category.id,
                          name: category.name,
                        })
                      }
                    >
                      <Trash2 className="size-4" />
                    </IconButton>
                  </div>
                </header>

                {!isCollapsed && (
                  <div className="divide-y divide-border">
                    {category.products.length === 0 && (
                      <p className="px-4 py-6 text-center text-sm text-muted">
                        Bu kategoride ürün yok.
                      </p>
                    )}

                    {category.products.map((product) => {
                      const photo = latestFor(requests, {
                        kind: "product",
                        productId: product.id,
                      });
                      return (
                        <div key={product.id}>
                          <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                            <FoodImage
                              seed={product.id}
                              emoji={product.emoji}
                              src={product.image}
                              alt={product.name}
                              className="size-11 shrink-0"
                              emojiClassName="text-xl"
                              sizes="44px"
                            />

                            <div className="min-w-0 flex-1">
                              <p className="flex flex-wrap items-center gap-1.5 text-[15px] font-bold text-ink">
                                {product.name}
                                {product.popular && (
                                  <Badge tone="accent">Popüler</Badge>
                                )}
                                {photo?.status === "pending" && (
                                  <Badge tone="info">
                                    <Clock className="size-3" />
                                    Fotoğraf onayda
                                  </Badge>
                                )}
                                {photo?.status === "rejected" && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setProductModal({
                                        product,
                                        categoryId: category.id,
                                      })
                                    }
                                    title={photo.rejectReason}
                                  >
                                    <Badge tone="danger">
                                      <XCircle className="size-3" />
                                      Fotoğraf reddedildi
                                    </Badge>
                                  </button>
                                )}
                                {product.optionGroups.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setExpandedProduct(
                                        expandedProduct === product.id
                                          ? null
                                          : product.id
                                      )
                                    }
                                    className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] font-semibold text-muted hover:text-ink"
                                  >
                                    {product.optionGroups.length} seçenek grubu
                                  </button>
                                )}
                              </p>
                              <p className="truncate text-xs text-muted">
                                {product.description || "Açıklama yok"}
                              </p>
                            </div>

                            <span className="tabular shrink-0 font-extrabold text-ink">
                              {formatPrice(product.price)}
                            </span>

                            <StockToggle
                              soldOut={Boolean(product.soldOut)}
                              onChange={(soldOut) =>
                                productAction({
                                  action: "stock",
                                  productId: product.id,
                                  soldOut,
                                })
                              }
                            />

                            <div className="flex items-center gap-1">
                              <IconButton
                                label="Ürünü düzenle"
                                onClick={() =>
                                  setProductModal({
                                    product,
                                    categoryId: category.id,
                                  })
                                }
                              >
                                <Pencil className="size-4" />
                              </IconButton>
                              <IconButton
                                label="Ürünü sil"
                                danger
                                onClick={() =>
                                  setDeleting({
                                    kind: "product",
                                    id: product.id,
                                    name: product.name,
                                  })
                                }
                              >
                                <Trash2 className="size-4" />
                              </IconButton>
                            </div>
                          </div>

                          {/* Malzeme bazlı stok */}
                          {expandedProduct === product.id && (
                            <div className="space-y-3 border-t border-border bg-surface-2/50 px-4 py-3">
                              {product.optionGroups.map((group) => (
                                <div key={group.id}>
                                  <p className="mb-1.5 text-xs font-bold text-ink">
                                    {group.name}
                                    <span className="ml-1.5 font-medium text-muted">
                                      {group.type === "single"
                                        ? "tek seçim"
                                        : "çok seçim"}
                                    </span>
                                  </p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {group.options.map((option) => (
                                      <button
                                        key={option.id}
                                        type="button"
                                        onClick={() =>
                                          productAction({
                                            action: "option-stock",
                                            productId: product.id,
                                            groupId: group.id,
                                            optionId: option.id,
                                            soldOut: !option.soldOut,
                                          })
                                        }
                                        title={
                                          option.soldOut
                                            ? "Stoğa geri aç"
                                            : "Stoktan düş"
                                        }
                                        className={cn(
                                          "tabular rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
                                          option.soldOut
                                            ? "border-danger/40 bg-danger-soft text-danger line-through"
                                            : "border-border bg-surface text-ink hover:border-border-strong"
                                        )}
                                      >
                                        {option.name}
                                        {option.priceDelta !== 0 && (
                                          <span className="ml-1 text-muted">
                                            {option.priceDelta > 0 ? "+" : ""}
                                            {option.priceDelta}₺
                                          </span>
                                        )}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              ))}
                              <p className="text-xs text-muted">
                                Bir malzemeye dokunarak anında stoktan düşebilirsin.
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* Kategori modalı */}
      {categoryModal && (
        <CategoryModal
          category={categoryModal === "new" ? null : categoryModal}
          onClose={() => setCategoryModal(null)}
          onSubmit={async (name, description) => {
            const ok = await categoryAction({
              action: "upsert",
              id: categoryModal === "new" ? undefined : categoryModal.id,
              name,
              description,
            });
            if (ok) {
              toast.success(
                categoryModal === "new"
                  ? "Kategori eklendi."
                  : "Kategori güncellendi."
              );
              setCategoryModal(null);
            }
          }}
        />
      )}

      {/* Ürün modalı */}
      {productModal && (
        <ProductEditor
          open
          onClose={() => setProductModal(null)}
          product={productModal.product}
          categoryId={productModal.categoryId}
          categories={menu}
          onSaved={setMenu}
          requests={requests}
          onRequestsChange={setRequests}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          const ok =
            deleting.kind === "category"
              ? await categoryAction({ action: "delete", id: deleting.id })
              : await productAction({
                  action: "delete",
                  productId: deleting.id,
                });
          if (ok) {
            toast.success(`"${deleting.name}" silindi.`);
            // Silinen ürünlerin bekleyen fotoğrafları sunucuda da düştü
            loadRequests();
          }
        }}
        title={
          deleting?.kind === "category" ? "Kategoriyi sil" : "Ürünü sil"
        }
        description={
          deleting?.kind === "category"
            ? `"${deleting.name}" kategorisi ve içindeki tüm ürünler menüden kaldırılacak.`
            : `"${deleting?.name}" menüden kaldırılacak.`
        }
        confirmLabel="Sil"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function CategoryModal({
  category,
  onClose,
  onSubmit,
}: {
  category: MenuCategory | null;
  onClose: () => void;
  onSubmit: (name: string, description: string) => void;
}) {
  const [name, setName] = useState(category?.name ?? "");
  const [description, setDescription] = useState(category?.description ?? "");

  return (
    <Modal
      open
      onClose={onClose}
      title={category ? "Kategoriyi düzenle" : "Yeni kategori"}
      description="Kategoriler müşteri menüsünde bu sırayla görünür."
      size="sm"
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" block onClick={onClose}>
            Vazgeç
          </Button>
          <Button
            block
            disabled={name.trim().length < 2}
            onClick={() => onSubmit(name.trim(), description.trim())}
          >
            Kaydet
          </Button>
        </div>
      }
    >
      <div className="space-y-4 pt-1">
        <Field label="Kategori adı" required>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Örn. Başlangıçlar"
            maxLength={40}
            autoFocus
          />
        </Field>
        <Field label="Açıklama" hint="İsteğe bağlı, kategori başlığının altında görünür.">
          <Textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={120}
          />
        </Field>
      </div>
    </Modal>
  );
}

function StockToggle({
  soldOut,
  onChange,
}: {
  soldOut: boolean;
  onChange: (soldOut: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!soldOut}
      onClick={() => onChange(!soldOut)}
      className={cn(
        "inline-flex shrink-0 items-center gap-2 rounded-xl border px-2.5 py-1.5 text-xs font-bold transition-colors",
        soldOut
          ? "border-danger/40 bg-danger-soft text-danger"
          : "border-pistachio/35 bg-pistachio-soft text-pistachio"
      )}
    >
      <span
        className={cn(
          "size-2 rounded-full",
          soldOut ? "bg-danger" : "bg-pistachio"
        )}
      />
      {soldOut ? "Tükendi" : "Satışta"}
    </button>
  );
}

function IconButton({
  children,
  label,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "rounded-lg p-2 text-muted transition-colors disabled:opacity-35",
        danger
          ? "hover:bg-danger-soft hover:text-danger"
          : "hover:bg-surface-2 hover:text-ink"
      )}
    >
      {children}
    </button>
  );
}
