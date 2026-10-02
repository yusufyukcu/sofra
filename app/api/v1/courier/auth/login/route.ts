import { handle, ok, readJson } from "@/lib/api/respond";
import { respondWithCourierSession } from "@/lib/auth/courier-session";
import { courierLogin, courierPickerList } from "@/lib/services/courier";

/**
 * GET /api/v1/courier/auth/login
 * Giris ekranindaki kurye secicisi (kimlik dogrulama gerekmez).
 */
export async function GET() {
  return handle(async () => ok({ couriers: courierPickerList() }));
}

/**
 * POST /api/v1/courier/auth/login
 * Body: { courierId, pin }
 */
export async function POST(request: Request) {
  return handle(async () => {
    const body = await readJson<{ courierId?: string; pin?: string }>(request);
    const courier = courierLogin(body.courierId ?? "", body.pin ?? "");
    return respondWithCourierSession(courier);
  });
}
