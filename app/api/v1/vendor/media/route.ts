import { handle, ok } from "@/lib/api/respond";
import { requireVendor } from "@/lib/auth/vendor-session";
import { DomainError } from "@/lib/errors";
import {
  MAX_UPLOAD_BYTES,
  submitMediaRequest,
  vendorMediaRequests,
} from "@/lib/services/media";

/** Form alanları ve multipart sınırları için dosyaya eklenen pay. */
const FORM_OVERHEAD_BYTES = 64 * 1024;

/** GET /api/v1/vendor/media — restoranın fotoğraf talepleri, en yenisi başta */
export async function GET(request: Request) {
  return handle(async () => {
    const { restaurant } = await requireVendor(request);
    return ok({ requests: await vendorMediaRequests(restaurant.id) });
  });
}

/**
 * POST /api/v1/vendor/media — fotoğrafı onaya gönderir.
 * Gövde `multipart/form-data`:
 *   kind      → "cover" (restoran kapağı) | "product"
 *   productId → kind=product ise ürün kimliği
 *   file      → JPEG, PNG ya da WebP, en fazla 5 MB
 *
 * Fotoğraf yönetici onaylayana kadar yayına girmez.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const { restaurant } = await requireVendor(request);

    // Proxy gövdeyi 10 MB'ta keser; kesilmiş gövde bozuk form gibi görünür.
    // Boyutu baştan kontrol edip doğru mesajı ver.
    const declared = Number(request.headers.get("content-length"));
    if (declared > MAX_UPLOAD_BYTES + FORM_OVERHEAD_BYTES) {
      throw new DomainError(
        "file_too_large",
        "Fotoğraf en fazla 5 MB olabilir.",
        413
      );
    }

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      throw new DomainError(
        "invalid_form",
        "Fotoğraf multipart/form-data olarak gönderilmeli."
      );
    }

    const file = form.get("file");
    const created = await submitMediaRequest(restaurant.id, {
      kind: String(form.get("kind") ?? ""),
      productId: String(form.get("productId") ?? ""),
      file: file instanceof Blob ? file : null,
    });

    return ok(
      { request: created, requests: await vendorMediaRequests(restaurant.id) },
      { status: 201 }
    );
  });
}
