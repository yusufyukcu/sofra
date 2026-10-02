import sharp, { type Metadata } from "sharp";
import { commit, db, findRestaurant, recordAudit } from "../db/store";
import { DomainError } from "../errors";
import { deleteMedia, saveMedia } from "../media/storage";
import type {
  AdminAccount,
  MediaRequest,
  MediaTarget,
  Product,
  Restaurant,
} from "../types";
import { createId } from "../utils";

/**
 * Restoran fotoğrafları — yükleme ve onay akışı.
 *
 * Restoran panelden kapak ya da ürün fotoğrafı yükler; dosya işlenip
 * saklanır ama yayına girmez. Yönetici "Görsel onayları" ekranından
 * onaylayınca fotoğraf kapağa veya ürüne işlenir, reddederse gerekçesi
 * restorana görünür. Aynı hedefe bekleyen ikinci bir fotoğraf gönderilirse
 * yenisi eskisinin yerini alır — kuyrukta hedef başına tek talep durur.
 */

/** Yüklenebilecek en büyük dosya. Proxy gövdeyi 10 MB'a kadar tamponlar. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/**
 * Çıktı ölçüleri müşteri sitesindeki oranlarla aynı: kapak 16:9, ürün 4:3.
 * Fotoğraf bu orana kırpılır ama büyütülmez; kırpım en az `minWidth` geniş
 * olmalı, yoksa ekranda bulanık görünür.
 */
const OUTPUT = {
  cover: { width: 1600, height: 900, minWidth: 960 },
  product: { width: 1200, height: 900, minWidth: 480 },
} as const;

const ACCEPTED_FORMATS = new Set(["jpeg", "png", "webp"]);

const fileOf = (request: MediaRequest) => request.url.replace(/^\/media\//, "");

function sameTarget(a: MediaTarget, b: MediaTarget): boolean {
  if (a.kind === "cover" || b.kind === "cover") return a.kind === b.kind;
  return a.productId === b.productId;
}

function findProduct(restaurant: Restaurant, productId: string): Product | undefined {
  for (const category of restaurant.menu) {
    const product = category.products.find((p) => p.id === productId);
    if (product) return product;
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/* Görüntü işleme                                                      */
/* ------------------------------------------------------------------ */

/**
 * Dosyayı uzantısına ya da tarayıcının bildirdiği türe göre değil, içeriğini
 * çözerek doğrular. WebP'ye yeniden kodlamak EXIF'i (konum dahil) siler ve
 * fotoğraf kılığındaki başka içerikleri etkisizleştirir.
 */
async function processImage(input: Buffer, kind: MediaTarget["kind"]) {
  let meta: Metadata;
  try {
    meta = await sharp(input).metadata();
  } catch {
    throw new DomainError(
      "invalid_image",
      "Dosya okunamadı. JPEG, PNG ya da WebP bir fotoğraf yükle."
    );
  }
  if (!meta.format || !ACCEPTED_FORMATS.has(meta.format) || !meta.width || !meta.height) {
    throw new DomainError(
      "unsupported_image",
      "Yalnızca JPEG, PNG ya da WebP fotoğraf yüklenebilir."
    );
  }

  // EXIF'te 90°/270° dönük çekilmiş fotoğrafta en ve boy yer değiştirir
  const turned = (meta.orientation ?? 1) >= 5;
  const sourceWidth = turned ? meta.height : meta.width;
  const sourceHeight = turned ? meta.width : meta.height;

  const spec = OUTPUT[kind];
  const ratio = spec.width / spec.height;
  const width = Math.min(spec.width, sourceWidth, Math.floor(sourceHeight * ratio));
  const height = Math.round(width / ratio);

  if (width < spec.minWidth) {
    const minHeight = Math.round(spec.minWidth / ratio);
    throw new DomainError(
      "image_too_small",
      kind === "cover"
        ? `Fotoğraf kapak için küçük. En az ${spec.minWidth}×${minHeight} piksel olmalı.`
        : `Fotoğraf küçük. En az ${spec.minWidth}×${minHeight} piksel olmalı.`
    );
  }

  const data = await sharp(input)
    .rotate()
    .resize(width, height, { fit: "cover", position: "attention" })
    .webp({ quality: 80 })
    .toBuffer();

  return { data, width, height };
}

/* ------------------------------------------------------------------ */
/* Restoran paneli                                                     */
/* ------------------------------------------------------------------ */

export interface MediaUploadInput {
  kind: string;
  productId?: string;
  file: Blob | null;
}

export async function submitMediaRequest(
  restaurantId: string,
  input: MediaUploadInput
): Promise<MediaRequest> {
  const restaurant = findRestaurant(restaurantId);
  if (!restaurant) {
    throw new DomainError("restaurant_not_found", "Restoran bulunamadı.", 404);
  }

  let target: MediaTarget;
  let targetName: string;
  if (input.kind === "cover") {
    target = { kind: "cover" };
    targetName = "Kapak fotoğrafı";
  } else if (input.kind === "product") {
    const product = findProduct(restaurant, input.productId ?? "");
    if (!product) {
      throw new DomainError("product_not_found", "Ürün bulunamadı.", 404);
    }
    target = { kind: "product", productId: product.id };
    targetName = product.name;
  } else {
    throw new DomainError(
      "invalid_target",
      "Geçersiz hedef. Beklenen: cover ya da product."
    );
  }

  if (!input.file || input.file.size === 0) {
    throw new DomainError("file_required", "Bir fotoğraf seç.");
  }
  if (input.file.size > MAX_UPLOAD_BYTES) {
    throw new DomainError(
      "file_too_large",
      "Fotoğraf en fazla 5 MB olabilir.",
      413
    );
  }

  const processed = await processImage(
    Buffer.from(await input.file.arrayBuffer()),
    target.kind
  );

  const id = createId("med");
  saveMedia(`${id}.webp`, processed.data);

  // Aynı hedefe bekleyen eski talep varsa yenisi onun yerini alır
  const store = db();
  const replaced = store.mediaRequests.filter(
    (r) =>
      r.restaurantId === restaurant.id &&
      r.status === "pending" &&
      sameTarget(r.target, target)
  );
  replaced.forEach((r) => deleteMedia(fileOf(r)));
  store.mediaRequests = store.mediaRequests.filter((r) => !replaced.includes(r));

  const request: MediaRequest = {
    id,
    restaurantId: restaurant.id,
    target,
    targetName,
    url: `/media/${id}.webp`,
    width: processed.width,
    height: processed.height,
    bytes: processed.data.length,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  store.mediaRequests.unshift(request);
  commit();
  return request;
}

/** Restoranın talepleri, en yenisi başta. */
export function vendorMediaRequests(restaurantId: string): MediaRequest[] {
  return db()
    .mediaRequests.filter((r) => r.restaurantId === restaurantId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 100);
}

/** Bekleyen talebi geri çeker; dosya da silinir. */
export function withdrawMediaRequest(restaurantId: string, id: string): void {
  const store = db();
  const request = store.mediaRequests.find(
    (r) => r.id === id && r.restaurantId === restaurantId
  );
  if (!request) {
    throw new DomainError(
      "media_request_not_found",
      "Fotoğraf talebi bulunamadı.",
      404
    );
  }
  if (request.status !== "pending") {
    throw new DomainError(
      "media_request_closed",
      "Bu talep sonuçlandı, artık geri çekilemez."
    );
  }
  deleteMedia(fileOf(request));
  store.mediaRequests = store.mediaRequests.filter((r) => r.id !== id);
  commit();
}

/**
 * Menüden kaldırılan ürünlerin bekleyen taleplerini temizler — yöneticinin
 * kuyruğunda artık uygulanamayacak fotoğraf kalmasın.
 */
export function discardPendingMedia(restaurantId: string, productIds: string[]): void {
  if (productIds.length === 0) return;
  const store = db();
  const stale = store.mediaRequests.filter(
    (r) =>
      r.restaurantId === restaurantId &&
      r.status === "pending" &&
      r.target.kind === "product" &&
      productIds.includes(r.target.productId)
  );
  if (stale.length === 0) return;
  stale.forEach((r) => deleteMedia(fileOf(r)));
  store.mediaRequests = store.mediaRequests.filter((r) => !stale.includes(r));
}

/* ------------------------------------------------------------------ */
/* Yönetici paneli                                                     */
/* ------------------------------------------------------------------ */

export interface AdminMediaRow {
  request: MediaRequest;
  restaurant: Pick<Restaurant, "id" | "name" | "emoji" | "district" | "image">;
  /** Hedefin şu an yayındaki fotoğrafı — karşılaştırma için */
  currentImage?: string;
  /** Ürün menüden kaldırılmışsa onaylanamaz */
  targetExists: boolean;
}

/** Bekleyenler geliş sırasıyla başta; sonuçlananlardan son 60 karar. */
export function adminMediaRequests(): AdminMediaRow[] {
  const all = db().mediaRequests;
  const pending = all
    .filter((r) => r.status === "pending")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const decided = all
    .filter((r) => r.status !== "pending")
    .sort((a, b) => (b.decidedAt ?? "").localeCompare(a.decidedAt ?? ""))
    .slice(0, 60);

  return [...pending, ...decided].flatMap((request) => {
    const restaurant = findRestaurant(request.restaurantId);
    if (!restaurant) return [];
    const product =
      request.target.kind === "product"
        ? findProduct(restaurant, request.target.productId)
        : undefined;
    return [
      {
        request,
        restaurant: {
          id: restaurant.id,
          name: restaurant.name,
          emoji: restaurant.emoji,
          district: restaurant.district,
          image: restaurant.image,
        },
        currentImage:
          request.target.kind === "cover" ? restaurant.image : product?.image,
        targetExists: request.target.kind === "cover" || Boolean(product),
      },
    ];
  });
}

function pendingRequest(id: string): { request: MediaRequest; restaurant: Restaurant } {
  const request = db().mediaRequests.find((r) => r.id === id);
  if (!request) {
    throw new DomainError(
      "media_request_not_found",
      "Fotoğraf talebi bulunamadı.",
      404
    );
  }
  if (request.status !== "pending") {
    throw new DomainError("media_request_closed", "Bu talep zaten sonuçlandı.");
  }
  const restaurant = findRestaurant(request.restaurantId);
  if (!restaurant) {
    throw new DomainError("restaurant_not_found", "Restoran bulunamadı.", 404);
  }
  return { request, restaurant };
}

/** Fotoğrafı kapağa ya da ürüne işler; müşteri sitesinde anında görünür. */
export function approveMediaRequest(admin: AdminAccount, id: string): MediaRequest {
  const { request, restaurant } = pendingRequest(id);

  if (request.target.kind === "cover") {
    restaurant.image = request.url;
  } else {
    const product = findProduct(restaurant, request.target.productId);
    if (!product) {
      throw new DomainError(
        "product_not_found",
        "Ürün menüden kaldırılmış, fotoğraf uygulanamaz. Talebi reddedebilirsin.",
        409
      );
    }
    product.image = request.url;
  }

  request.status = "approved";
  request.decidedAt = new Date().toISOString();
  request.decidedBy = admin.name;
  commit();

  recordAudit(
    admin.name,
    "Fotoğraf onaylandı",
    restaurant.name,
    request.targetName
  );
  return request;
}

export function rejectMediaRequest(
  admin: AdminAccount,
  id: string,
  reason: string
): MediaRequest {
  const { request, restaurant } = pendingRequest(id);
  const text = reason.trim();
  if (text.length < 3) {
    throw new DomainError(
      "reason_required",
      "Restoran neyi düzelteceğini bilsin: kısa bir gerekçe yaz."
    );
  }

  request.status = "rejected";
  request.rejectReason = text.slice(0, 200);
  request.decidedAt = new Date().toISOString();
  request.decidedBy = admin.name;
  commit();

  recordAudit(
    admin.name,
    "Fotoğraf reddedildi",
    restaurant.name,
    `${request.targetName} · ${request.rejectReason}`
  );
  return request;
}

/* ------------------------------------------------------------------ */
/* Sunum                                                               */
/* ------------------------------------------------------------------ */

/** `/media/<dosya>` isteğinin kaydı — erişim kararı için. */
export function mediaByFile(file: string): MediaRequest | undefined {
  return db().mediaRequests.find((r) => r.url === `/media/${file}`);
}

export function pendingMediaCount(): number {
  return db().mediaRequests.filter((r) => r.status === "pending").length;
}
