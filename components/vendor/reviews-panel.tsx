"use client";

import { CornerDownRight, MessageSquare } from "lucide-react";
import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api-client";
import type { Review } from "@/lib/types";
import { cn, relativeTime } from "@/lib/utils";
import {
  Button,
  EmptyState,
  Skeleton,
  Stars,
  Textarea,
} from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";

type Filter = "all" | "unanswered" | "low";

/** Müşteri değerlendirmeleri ve cevap arayüzü. */
export function ReviewsPanel() {
  const toast = useToast();
  const [data, setData] = useState<{
    reviews: Review[];
    rating: number;
    ratingCount: number;
    unanswered: number;
  } | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get<NonNullable<typeof data>>("/vendor/reviews")
      .then(setData)
      .catch((err) => {
        toast.error(errorMessage(err));
        setData({ reviews: [], rating: 0, ratingCount: 0, unanswered: 0 });
      });
  }, [toast]);

  async function sendReply(reviewId: string) {
    setBusy(true);
    try {
      const result = await api.post<{ review: Review }>("/vendor/reviews", {
        reviewId,
        reply: draft,
      });
      setData((current) =>
        current
          ? {
              ...current,
              reviews: current.reviews.map((r) =>
                r.id === reviewId ? result.review : r
              ),
              unanswered: current.reviews.filter(
                (r) => !r.reply && r.id !== reviewId
              ).length,
            }
          : current
      );
      setReplyTo(null);
      setDraft("");
      toast.success("Cevabın yayınlandı.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const filtered = data.reviews.filter((review) => {
    if (filter === "unanswered") return !review.reply;
    if (filter === "low") return review.score <= 3;
    return true;
  });

  const distribution = [5, 4, 3, 2, 1].map((score) => ({
    score,
    count: data.reviews.filter((r) => r.score === score).length,
  }));
  const max = Math.max(1, ...distribution.map((d) => d.count));

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display text-2xl font-extrabold text-ink">
          Değerlendirmeler
        </h1>
        <p className="mt-0.5 text-sm text-muted">
          Yorumlara cevap vermek puanını ve müşteri güvenini yükseltir.
        </p>
      </header>

      <section className="card flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
        <div className="sm:w-36 sm:text-center">
          <p className="font-display tabular text-4xl font-extrabold text-ink">
            {data.rating.toFixed(1)}
          </p>
          <Stars value={data.rating} size={16} className="mt-1" />
          <p className="tabular mt-1 text-xs text-muted">
            {data.ratingCount} değerlendirme
          </p>
        </div>

        <div className="flex-1 space-y-1.5">
          {distribution.map((row) => (
            <div key={row.score} className="flex items-center gap-2">
              <span className="tabular w-3 text-xs font-semibold text-muted">
                {row.score}
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3">
                <div
                  className="h-full rounded-full bg-saffron"
                  style={{ width: `${(row.count / max) * 100}%` }}
                />
              </div>
              <span className="tabular w-7 text-right text-xs text-muted">
                {row.count}
              </span>
            </div>
          ))}
        </div>

        {data.unanswered > 0 && (
          <div className="rounded-xl bg-brand-soft px-4 py-3 text-center">
            <p className="font-display tabular text-2xl font-extrabold text-brand">
              {data.unanswered}
            </p>
            <p className="text-xs font-semibold text-brand">cevap bekliyor</p>
          </div>
        )}
      </section>

      <div className="flex gap-1 rounded-xl bg-surface-2 p-1">
        {(
          [
            ["all", `Tümü (${data.reviews.length})`],
            ["unanswered", `Cevaplanmamış (${data.unanswered})`],
            [
              "low",
              `Düşük puan (${data.reviews.filter((r) => r.score <= 3).length})`,
            ],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={cn(
              "flex-1 rounded-lg py-2 text-sm font-semibold transition-colors",
              filter === id
                ? "bg-surface text-ink shadow-sm"
                : "text-muted hover:text-ink"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          emoji="💬"
          title="Bu filtrede yorum yok"
          description="Müşteriler siparişlerini değerlendirdikçe burada görünecek."
        />
      ) : (
        <ul className="space-y-3">
          {filtered.map((review) => (
            <li key={review.id} className="card p-5">
              <div className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-sm font-bold text-muted">
                  {review.userName.charAt(0)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-ink">
                    {review.userName}
                  </p>
                  <div className="mt-0.5 flex items-center gap-2">
                    <Stars value={review.score} size={12} />
                    <span className="text-xs text-muted">
                      {relativeTime(review.at)}
                    </span>
                  </div>
                </div>
                {!review.reply && (
                  <span className="shrink-0 rounded-md bg-brand-soft px-2 py-0.5 text-[11px] font-bold text-brand">
                    Cevap bekliyor
                  </span>
                )}
              </div>

              <p className="mt-3 text-sm leading-relaxed text-text">
                {review.comment}
              </p>

              {review.reply ? (
                <div className="mt-3 flex gap-2 rounded-xl bg-surface-2 p-3">
                  <CornerDownRight className="mt-0.5 size-4 shrink-0 text-muted" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-ink">Cevabın</p>
                    <p className="mt-0.5 text-sm text-muted">{review.reply}</p>
                  </div>
                </div>
              ) : replyTo === review.id ? (
                <div className="mt-3 space-y-2">
                  <Textarea
                    rows={3}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    maxLength={400}
                    autoFocus
                    placeholder="Müşteriye nazik ve somut bir cevap yaz…"
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setReplyTo(null);
                        setDraft("");
                      }}
                    >
                      Vazgeç
                    </Button>
                    <Button
                      loading={busy}
                      disabled={draft.trim().length < 2}
                      onClick={() => sendReply(review.id)}
                    >
                      Cevabı yayınla
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-3"
                  onClick={() => {
                    setReplyTo(review.id);
                    setDraft("");
                  }}
                >
                  <MessageSquare className="size-3.5" />
                  Cevap yaz
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
