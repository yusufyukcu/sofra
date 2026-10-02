import type { Metadata } from "next";
import { ReviewsPanel } from "@/components/vendor/reviews-panel";

export const metadata: Metadata = { title: "Degerlendirmeler" };

export default function VendorReviewsPage() {
  return <ReviewsPanel />;
}
