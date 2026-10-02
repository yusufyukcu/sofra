import { handle, ok } from "@/lib/api/respond";
import { requireCourier } from "@/lib/auth/courier-session";
import { earningsReport } from "@/lib/services/courier";

/** GET /api/v1/courier/earnings — paket basi kazanc, bahsis, hakedis */
export async function GET(request: Request) {
  return handle(async () => {
    const courier = await requireCourier(request);
    return ok({ report: earningsReport(courier) });
  });
}
