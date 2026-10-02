import { handle, ok } from "@/lib/api/respond";
import { requireUser } from "@/lib/auth/session";
import { deleteCard } from "@/lib/services/cards";

/** DELETE /api/v1/cards/:id — kayıtlı kartı siler */
export async function DELETE(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const user = await requireUser(request);
    const { id } = await ctx.params;
    return ok({ cards: await deleteCard(user, id) });
  });
}
