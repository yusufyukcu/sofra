import { fail, handle, ok, readJson } from "@/lib/api/respond";
import {
  applicationStatus,
  submitApplication,
  type ApplicationInput,
} from "@/lib/services/partner";

/**
 * POST /api/v1/partner/apply — restoran katılım başvurusu.
 *
 * Oturum gerektirmez: başvuran henüz platformda değil. Başvuru alındığında
 * yöneticinin onay kuyruğuna bir restoran taslağı düşer.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const body = await readJson<ApplicationInput>(request);
    const application = await submitApplication(body);

    return ok(
      {
        code: application.code,
        businessName: application.businessName,
        status: application.status,
        createdAt: application.createdAt,
      },
      { status: 201 }
    );
  });
}

/**
 * GET /api/v1/partner/apply?kod=SF-BV-4H2K — başvuru durumu.
 *
 * Yalnızca başvuranın görmesi gereken alanları döndürür; iletişim ve vergi
 * bilgisi burada yer almaz.
 */
export async function GET(request: Request) {
  return handle(async () => {
    const code = new URL(request.url).searchParams.get("kod");
    if (!code) {
      return fail("missing_code", "Başvuru referans kodunu gir.");
    }
    return ok(await applicationStatus(code));
  });
}
