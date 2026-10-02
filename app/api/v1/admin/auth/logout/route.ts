import { handle } from "@/lib/api/respond";
import { clearAdminSessionResponse } from "@/lib/auth/admin-session";

/** POST /api/v1/admin/auth/logout */
export async function POST() {
  return handle(async () => clearAdminSessionResponse());
}
