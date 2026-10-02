"use client";

import { MessageCircleQuestion } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { ChatPanel } from "./chat-panel";

/** Sağ alttaki canlı destek düğmesi. */
export function SupportLauncher() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const hidden =
    pathname === "/destek" || pathname === "/giris" || pathname === "/odeme";
  if (hidden) return null;

  return (
    <>
      <button
        type="button"
        data-support-launcher
        onClick={() => setOpen(true)}
        aria-label="Canlı destek"
        className="fixed bottom-24 right-4 z-40 flex size-13 items-center justify-center rounded-full bg-text text-bg shadow-float transition-transform hover:scale-105 active:scale-95 lg:bottom-6 lg:right-6 lg:size-14"
      >
        <MessageCircleQuestion className="size-6" />
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Sofra Asistanı"
        description="Siparişin, iptal ve iade konularında yardımcı olabilirim."
        size="sm"
      >
        <ChatPanel className="h-[60dvh] sm:h-[420px]" />
      </Modal>
    </>
  );
}
