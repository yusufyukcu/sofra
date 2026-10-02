import "server-only";
import sharp, { type Metadata } from "sharp";
import { sql } from "../db/client";
import { findRestaurantRow, recordAudit } from "../db/queries";
import { toMediaRequest, type MediaRow } from "../db/mappers";
import { DomainError } from "../errors";
import { deleteMedia, saveMedia } from "../media/storage";
import type { AdminAccount, MediaRequest, MediaTarget, Restaurant } from "../types";
import { createId } from "../utils";

/**
 * Restoran fotoğrafları — yükleme ve onay akışı.
 *
 * Restoran panelden kapak ya da ürün fotoğrafı yükler; dosya işlenip
 * depoya yazılır ama yayına girmez. Yönetici onaylayınca fotoğraf kapağa
 * veya ürüne işlenir, reddederse gerekçesi restorana görünür. Aynı hedefe
 * bekleyen ikinci fotoğraf gönderilirse yenisi eskisinin yerini alır.
 */

/** Yüklenebilecek en büyük dosya. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/**
 * Çıktı ölçüleri müşteri sitesindeki oranlarla aynı: kapak 16:9, ürün 4:3.
 * Fotoğraf bu orana kırpılır ama büyütülmez.
 */
const OUTPUT = {
  cover: { width: 1600, height: 900, minWidth: 960 },
  product: { width: 1200, height: 900, minWidth: 480 },
} as const;

const ACCEPTED_FORMATS = new Set(["jpeg", "png", "webp"]);

/* ------------------------------------------------------------------ */
/* Görüntü işleme                                                      */
/* ------------------------------------------------------------------ */

/**
 * Dosya uzantısına değil içeriğine bakarak doğrulanır. WebP'ye yeniden
 * kodlamak EXIF'i (konum dahil) siler ve fotoğraf kılığındaki başka
 * içerikleri etkisizleştirir.
 */
async function processImage(input: Buffer, kind: MediaTarget["kind"]) {
  let meta: Metadata;
  try {
    meta = await sharp(input).metadata();
  } catch {
    throw new DomainError("invalid_image", "Dosya okunamadı. JPEG, PNG ya da WebP bir fotoğraf yükle.");
  }
  if (!meta.format || !ACCEPTED_FORMATS.has(meta.format) || !meta.width || !meta.height) {
    throw new DomainError("unsupported_image", "Yalnızca JPEG, PNG ya da WebP fotoğraf yüklenebilir.");
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
  const restaurant = await findRestaurantRow(restaurantId);
  if (!restaurant) throw new DomainError("restaurant_not_found", "Restoran bulunamadı.", 404);

  let target: MediaTarget;
  let targetName: string;
  if (input.kind === "cover") {
    target = { kind: "cover" };
    targetName = "Kapak fotoğrafı";
  } else if (input.kind === "product") {
    const [product] = await sql<{ id: string; name: string }[]>`
      select id, name from public.products
       where id = ${input.productId ?? ""} and restaurant_id = ${restaurant.id}
    `;
    if (!product) throw new DomainError("product_not_found", "Ürün bulunamadı.", 404);
    target = { kind: "product", productId: product.id };
    targetName = product.name;
  } else {
    throw new DomainError("invalid_target", "Geçersiz hedef. Beklenen: cover ya da product.");
  }

  if (!input.file || input.file.size === 0) throw new DomainError("file_required", "Bir fotoğraf seç.");
  if (input.file.size > MAX_UPLOAD_BYTES) {
    throw new DomainError("file_too_large", "Fotoğraf en fazla 5 MB olabilir.", 413);
  }

  const processed = await processImage(Buffer.from(await input.file.arrayBuffer()), target.kind);

  const id = createId("med");
  const file = `${id}.webp`;
  await saveMedia(file, processed.data);

  // Aynı hedefe bekleyen eski talep varsa yenisi onun yerini alır
  const productId = target.kind === "product" ? target.productId : null;
  const replaced = await sql.begin(async (tx) => {
    const old = await tx<{ storagePath: string }[]>`
      delete from public.media_requests
       where restaurant_id = ${restaurant.id} and status = 'pending'
         and target_kind = ${target.kind}
         and (${productId}::text is null or target_product_id = ${productId}::text)
      returning storage_path
    `;
    await tx`
      insert into public.media_requests (
        id, restaurant_id, target_kind, target_product_id, target_name, storage_path, url,
        width, height, bytes, status
      ) values (
        ${id}, ${restaurant.id}, ${target.kind}, ${productId}, ${targetName}, ${file},
        ${`/media/${file}`}, ${processed.width}, ${processed.height}, ${processed.data.length}, 'pending'
      )
    `;
    return old.map((o) => o.storagePath);
  });
  await deleteMedia(replaced);

  const [row] = await sql<MediaRow[]>`select * from public.media_requests where id = ${id}`;
  return toMediaRequest(row);
}

/** Restoranın talepleri, en yenisi başta. */
export async function vendorMediaRequests(restaurantId: string): Promise<MediaRequest[]> {
  const rows = await sql<MediaRow[]>`
    select * from public.media_requests where restaurant_id = ${restaurantId}
     order by created_at desc limit 100
  `;
  return rows.map(toMediaRequest);
}

/** Bekleyen talebi geri çeker; dosya da silinir. */
export async function withdrawMediaRequest(restaurantId: string, id: string): Promise<void> {
  const [row] = await sql<MediaRow[]>`
    select * from public.media_requests where id = ${id} and restaurant_id = ${restaurantId}
  `;
  if (!row) throw new DomainError("media_request_not_found", "Fotoğraf talebi bulunamadı.", 404);
  if (row.status !== "pending") {
    throw new DomainError("media_request_closed", "Bu talep sonuçlandı, artık geri çekilemez.");
  }
  await sql`delete from public.media_requests where id = ${id} and status = 'pending'`;
  await deleteMedia([row.storagePath]);
}

/** Menüden kaldırılan ürünlerin bekleyen taleplerini temizler. */
export async function discardPendingMedia(restaurantId: string, productIds: string[]): Promise<void> {
  if (productIds.length === 0) return;
  const stale = await sql<{ storagePath: string }[]>`
    delete from public.media_requests
     where restaurant_id = ${restaurantId} and status = 'pending' and target_kind = 'product'
       and target_product_id = any(${productIds}::text[])
    returning storage_path
  `;
  await deleteMedia(stale.map((s) => s.storagePath));
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
export async function adminMediaRequests(): Promise<AdminMediaRow[]> {
  const rows = await sql<
    (MediaRow & {
      restaurantName: string;
      restaurantEmoji: string;
      restaurantDistrict: string;
      restaurantImage: string | null;
      productImage: string | null;
      productExists: boolean;
    })[]
  >`
    (select m.*, r.name as restaurant_name, r.emoji as restaurant_emoji, r.district as restaurant_district,
            r.image as restaurant_image, p.image as product_image, (p.id is not null) as product_exists
       from public.media_requests m
       join public.restaurants r on r.id = m.restaurant_id
       left join public.products p on p.id = m.target_product_id
      where m.status = 'pending'
      order by m.created_at)
    union all
    (select m.*, r.name, r.emoji, r.district, r.image, p.image, (p.id is not null)
       from public.media_requests m
       join public.restaurants r on r.id = m.restaurant_id
       left join public.products p on p.id = m.target_product_id
      where m.status <> 'pending'
      order by m.decided_at desc nulls last
      limit 60)
  `;

  return rows.map((row) => ({
    request: toMediaRequest(row),
    restaurant: {
      id: row.restaurantId,
      name: row.restaurantName,
      emoji: row.restaurantEmoji,
      district: row.restaurantDistrict,
      image: row.restaurantImage ?? undefined,
    },
    currentImage:
      row.targetKind === "cover" ? row.restaurantImage ?? undefined : row.productImage ?? undefined,
    targetExists: row.targetKind === "cover" || row.productExists,
  }));
}

/** Fotoğrafı kapağa ya da ürüne işler; müşteri sitesinde anında görünür. */
export async function approveMediaRequest(admin: AdminAccount, id: string): Promise<void> {
  const result = await sql.begin(async (tx) => {
    const [row] = await tx<MediaRow[]>`select * from public.media_requests where id = ${id} for update`;
    if (!row) throw new DomainError("media_request_not_found", "Fotoğraf talebi bulunamadı.", 404);
    if (row.status !== "pending") throw new DomainError("media_request_closed", "Bu talep zaten sonuçlandı.");

    if (row.targetKind === "cover") {
      await tx`update public.restaurants set image = ${row.url} where id = ${row.restaurantId}`;
    } else {
      const updated = await tx`
        update public.products set image = ${row.url}
         where id = ${row.targetProductId} and restaurant_id = ${row.restaurantId}
        returning id
      `;
      if (updated.length === 0) {
        throw new DomainError(
          "product_not_found",
          "Ürün menüden kaldırılmış, fotoğraf uygulanamaz. Talebi reddedebilirsin.",
          409
        );
      }
    }

    await tx`
      update public.media_requests
         set status = 'approved', decided_at = now(), decided_by = ${admin.name}
       where id = ${id}
    `;
    const [restaurant] = await tx<{ name: string }[]>`select name from public.restaurants where id = ${row.restaurantId}`;
    return { restaurantName: restaurant?.name ?? row.restaurantId, targetName: row.targetName };
  });

  await recordAudit(admin.name, "Fotoğraf onaylandı", result.restaurantName, result.targetName);
}

export async function rejectMediaRequest(admin: AdminAccount, id: string, reason: string): Promise<void> {
  const text = reason.trim();
  if (text.length < 3) {
    throw new DomainError("reason_required", "Restoran neyi düzelteceğini bilsin: kısa bir gerekçe yaz.");
  }

  const [row] = await sql<(MediaRow & { restaurantName: string })[]>`
    update public.media_requests m
       set status = 'rejected', reject_reason = ${text.slice(0, 200)}, decided_at = now(),
           decided_by = ${admin.name}
      from public.restaurants r
     where m.id = ${id} and m.status = 'pending' and r.id = m.restaurant_id
    returning m.*, r.name as restaurant_name
  `;
  if (!row) throw new DomainError("media_request_closed", "Bu talep bulunamadı ya da zaten sonuçlandı.");

  await recordAudit(admin.name, "Fotoğraf reddedildi", row.restaurantName, `${row.targetName} · ${row.rejectReason}`);
}

/* ------------------------------------------------------------------ */
/* Sunum                                                               */
/* ------------------------------------------------------------------ */

/** `/media/<dosya>` isteğinin kaydı — erişim kararı için. */
export async function mediaByFile(file: string): Promise<MediaRequest | null> {
  const [row] = await sql<MediaRow[]>`select * from public.media_requests where url = ${`/media/${file}`}`;
  return row ? toMediaRequest(row) : null;
}

export async function pendingMediaCount(): Promise<number> {
  const [row] = await sql<{ n: number }[]>`
    select count(*)::int as n from public.media_requests where status = 'pending'
  `;
  return row.n;
}
