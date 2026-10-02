import { handle, ok } from "@/lib/api/respond";
import { requireCourier } from "@/lib/auth/courier-session";
import { performanceReport } from "@/lib/services/courier";

/** GET /api/v1/courier/performance — metrikler */
export async function GET(request: Request) {
  return handle(async () => {
    const courier = await requireCourier(request);
    return ok({ report: performanceReport(courier) });
  });
}
