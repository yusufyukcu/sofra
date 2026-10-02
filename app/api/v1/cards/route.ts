import { handle, ok, readJson } from "@/lib/api/respond";
import { requireUser } from "@/lib/auth/session";
import { cardsOf } from "@/lib/db/queries";
import { addCard, paymentSimulated, type CardInput } from "@/lib/services/cards";

/** GET /api/v1/cards — kayıtlı kartlar ve ödeme modu */
export async function GET(request: Request) {
  return handle(async () => {
    const user = await requireUser(request);
    return ok({ cards: await cardsOf(user.id), simulated: paymentSimulated() });
  });
}

/**
 * POST /api/v1/cards
 * Body: { number, expiry: "AA/YY", cvc, holder, nickname? }
 *
 * Kart numarası ve güvenlik kodu saklanmaz; yalnızca marka, son 4 hane,
 * ad ve son kullanma tarihi tutulur. Simülasyonda yalnızca test kartları.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser(request);
    const body = await readJson<CardInput>(request);
    return ok({ cards: await addCard(user, body) }, { status: 201 });
  });
}
