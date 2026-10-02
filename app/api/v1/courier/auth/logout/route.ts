import { handle } from "@/lib/api/respond";
import { clearCourierSessionResponse } from "@/lib/auth/courier-session";

/** POST /api/v1/courier/auth/logout */
export async function POST() {
  return handle(async () => clearCourierSessionResponse());
}
