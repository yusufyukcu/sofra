import { fail, handle, ok } from "@/lib/api/respond";
import { currentAdmin, publicAdmin } from "@/lib/auth/admin-session";
import { adminOverview } from "@/lib/services/admin";

/** GET /api/v1/admin/auth/me — panel acilisinda onyukleme */
export async function GET(request: Request) {
  return handle(async () => {
    const admin = await currentAdmin(request);
    if (!admin) return fail("admin_unauthorized", "Giris yapilmamis.", 401);
    return ok({ admin: publicAdmin(admin), kpi: (await adminOverview()).kpi });
  });
}
