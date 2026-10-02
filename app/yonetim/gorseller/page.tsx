import type { Metadata } from "next";
import { MediaReviewPanel } from "@/components/admin/media-review-panel";

export const metadata: Metadata = { title: "Görsel onayları" };

export default function AdminMediaPage() {
  return <MediaReviewPanel />;
}
