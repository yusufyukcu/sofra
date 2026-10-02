import { handle, ok, readJson } from "@/lib/api/respond";
import { requireUser } from "@/lib/auth/session";
import { createAddress, listAddresses, type AddressInput } from "@/lib/services/account";

/** GET /api/v1/addresses — kullanıcının adres defteri */
export async function GET(request: Request) {
  return handle(async () => {
    const user = await requireUser(request);
    return ok({ addresses: listAddresses(user) });
  });
}

/** POST /api/v1/addresses — yeni adres (harita pininden gelen `point` zorunlu) */
export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser(request);
    const body = await readJson<AddressInput>(request);
    const address = createAddress(user, body);
    return ok({ address, addresses: listAddresses(user) }, { status: 201 });
  });
}
