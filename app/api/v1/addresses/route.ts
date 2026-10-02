import { handle, ok, readJson } from "@/lib/api/respond";
import { requireUser } from "@/lib/auth/session";
import { createAddress, listAddresses, type AddressInput } from "@/lib/services/account";

/** GET /api/v1/addresses — kayıtlı teslimat adresleri */
export async function GET(request: Request) {
  return handle(async () => {
    const user = await requireUser(request);
    return ok({ addresses: await listAddresses(user) });
  });
}

/** POST /api/v1/addresses — yeni adres (konum haritadan seçilir) */
export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser(request);
    const body = await readJson<AddressInput>(request);
    const address = await createAddress(user, body);
    return ok({ address, addresses: await listAddresses(user) }, { status: 201 });
  });
}
