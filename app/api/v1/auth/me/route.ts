import { fail, handle, ok, readJson } from "@/lib/api/respond";
import { currentUser, requireUser } from "@/lib/auth/session";
import { cardsOf } from "@/lib/db/store";
import { listAddresses } from "@/lib/services/account";
import { updateProfile } from "@/lib/services/auth";
import { activeOrders } from "@/lib/services/orders";

/**
 * GET /api/v1/auth/me
 * Oturum açmış kullanıcının profili, adresleri, kayıtlı kartları ve
 * devam eden siparişleri. Uygulama açılışında tek istekte önyükleme yapar.
 */
export async function GET(request: Request) {
  return handle(async () => {
    const user = await currentUser(request);
    if (!user) return fail("unauthorized", "Giriş yapılmamış.", 401);

    return ok({
      user,
      addresses: listAddresses(user),
      cards: cardsOf(user.id),
      activeOrders: activeOrders(user),
    });
  });
}

/** PATCH /api/v1/auth/me — profil güncelleme */
export async function PATCH(request: Request) {
  return handle(async () => {
    const user = await requireUser(request);
    const body = await readJson<{
      name?: string;
      email?: string;
      phone?: string;
      avatarEmoji?: string;
    }>(request);

    return ok({ user: updateProfile(user, body) });
  });
}
