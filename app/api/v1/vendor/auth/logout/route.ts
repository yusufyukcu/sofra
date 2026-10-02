import { handle } from "@/lib/api/respond";
import { clearVendorSessionResponse } from "@/lib/auth/vendor-session";

/** POST /api/v1/vendor/auth/logout */
export async function POST() {
  return handle(async () => clearVendorSessionResponse());
}
