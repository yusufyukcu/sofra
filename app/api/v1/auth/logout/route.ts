import { handle } from "@/lib/api/respond";
import { clearSessionResponse } from "@/lib/auth/session";

/** POST /api/v1/auth/logout — oturum çerezini siler. */
export async function POST() {
  return handle(async () => clearSessionResponse());
}
