import { handle, ok } from "@/lib/api/respond";
import { requireVendor } from "@/lib/auth/vendor-session";
import { financeReport, type FinancePeriod } from "@/lib/services/vendor";

/** GET /api/v1/vendor/finance?donem=day|week|month */
export async function GET(request: Request) {
  return handle(async () => {
    const { restaurant } = await requireVendor(request);
    const raw = new URL(request.url).searchParams.get("donem");
    const period: FinancePeriod =
      raw === "week" || raw === "month" ? raw : "day";

    return ok({ report: await financeReport(restaurant.id, period) });
  });
}
