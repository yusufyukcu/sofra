import { currentAdmin } from "@/lib/auth/admin-session";
import { currentVendor } from "@/lib/auth/vendor-session";
import { readMedia } from "@/lib/media/storage";
import { mediaByFile } from "@/lib/services/media";

/**
 * GET /media/:file — restoranların yüklediği fotoğraflar (Supabase Storage).
 *
 * Onaylanan fotoğraf herkese açıktır ve dosya adı her yüklemede yeni
 * olduğu için kalıcı önbelleğe alınır. Onay bekleyen ya da reddedilen
 * fotoğrafı yalnızca yükleyen restoran ve yönetici görebilir; diğer herkes
 * için böyle bir dosya yoktur (404).
 */
export async function GET(request: Request, ctx: { params: Promise<{ file: string }> }) {
  const { file } = await ctx.params;
  const record = await mediaByFile(file);
  if (!record) return notFound();

  if (record.status !== "approved") {
    const admin = await currentAdmin(request);
    if (!admin) {
      const vendor = await currentVendor(request);
      if (vendor?.restaurant.id !== record.restaurantId) return notFound();
    }
  }

  const data = await readMedia(file);
  if (!data) return notFound();

  return new Response(new Uint8Array(data), {
    headers: {
      "content-type": "image/webp",
      "content-length": String(data.length),
      "x-content-type-options": "nosniff",
      "cache-control":
        record.status === "approved" ? "public, max-age=31536000, immutable" : "private, no-store",
    },
  });
}

function notFound() {
  return new Response("Bulunamadı", { status: 404, headers: { "cache-control": "no-store" } });
}
