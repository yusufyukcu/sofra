import { handle, ok, readJson } from "@/lib/api/respond";
import { requireUser } from "@/lib/auth/session";
import {
  deleteAddress,
  listAddresses,
  updateAddress,
  type AddressInput,
} from "@/lib/services/account";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/v1/addresses/:id */
export async function PATCH(request: Request, ctx: Ctx) {
  return handle(async () => {
    const user = await requireUser(request);
    const { id } = await ctx.params;
    const body = await readJson<Partial<AddressInput>>(request);
    const address = updateAddress(user, id, body);
    return ok({ address, addresses: listAddresses(user) });
  });
}

/** DELETE /api/v1/addresses/:id */
export async function DELETE(request: Request, ctx: Ctx) {
  return handle(async () => {
    const user = await requireUser(request);
    const { id } = await ctx.params;
    return ok({ addresses: deleteAddress(user, id) });
  });
}
