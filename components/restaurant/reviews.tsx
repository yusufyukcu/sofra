"use client";

import { CornerDownRight, MessageSquareText } from "lucide-react";
import { useState } from "react";
import type { Review } from "@/lib/types";
import { cn, relativeTime } from "@/lib/utils";
import { Button, EmptyState, Stars } from "@/components/ui/primitives";

/** Restoran değerlendirmeleri: puan dağılımı + yorum listesi. */
export function ReviewList({
  reviews,
  rating,
  ratingCount,
}: {
  reviews: Review[];
  rating: number;
  ratingCount: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? reviews : reviews.slice(0, 4);

  if (!reviews.length) {
    return (
      <EmptyState
        icon={MessageSquareText}
        title="Henüz yorum yok"
        description="İlk değerlendirmeyi sen yapabilirsin — siparişin teslim edildikten sonra puan verebilirsin."
      />
    );
  }

  const distribution = [5, 4, 3, 2, 1].map((score) => ({
    score,
    count: reviews.filter((r) => r.score === score).length,
  }));
  const max = Math.max(1, ...distribution.map((d) => d.count));

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-col gap-5 border-b border-border p-5 sm:flex-row sm:items-center">
        <div className="text-center sm:w-36">
          <p className="text-4xl font-extrabold tracking-tight text-text">
            {rating.toFixed(1)}
          </p>
          <Stars value={rating} size={16} className="mt-1 justify-center" />
          <p className="mt-1 text-xs text-muted">{ratingCount} değerlendirme</p>
        </div>

        <div className="flex-1 space-y-1.5">
          {distribution.map((row) => (
            <div key={row.score} className="flex items-center gap-2">
              <span className="w-3 text-xs font-semibold text-muted">
                {row.score}
              </span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${(row.count / max) * 100}%` }}
                />
              </div>
              <span className="w-6 text-right text-xs text-muted">
                {row.count}
              </span>
            </div>
          ))}
        </div>
      </div>

      <ul className="divide-y divide-border">
        {visible.map((review) => (
          <li key={review.id} className="p-5">
            <div className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-sm font-bold text-muted">
                {review.userName.charAt(0)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-text">
                  {review.userName}
                </p>
                <div className="mt-0.5 flex items-center gap-2">
                  <Stars value={review.score} size={12} />
                  <span className="text-xs text-muted">
                    {relativeTime(review.at)}
                  </span>
                </div>
              </div>
            </div>

            <p className="mt-2.5 text-sm leading-relaxed text-text">
              {review.comment}
            </p>

            {review.reply && (
              <div className="mt-3 flex gap-2 rounded-xl bg-surface-2 p-3">
                <CornerDownRight className="mt-0.5 size-4 shrink-0 text-muted" />
                <div>
                  <p className="text-xs font-bold text-text">Restoran yanıtı</p>
                  <p className="mt-0.5 text-sm text-muted">{review.reply}</p>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>

      {reviews.length > 4 && (
        <div className={cn("border-t border-border p-4")}>
          <Button
            variant="secondary"
            block
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded
              ? "Daha az göster"
              : `Tüm ${reviews.length} yorumu göster`}
          </Button>
        </div>
      )}
    </div>
  );
}
