"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { ChatPanel } from "./chat-panel";

const FAQ: { question: string; answer: string }[] = [
  {
    question: "Siparişim ne zaman gelir?",
    answer:
      "Tahmini teslim süresi restoranın hazırlama süresi ve adresine olan mesafeye göre hesaplanır. Sipariş takip ekranından kuryeni canlı olarak haritada izleyebilir, kalan süreyi görebilirsin.",
  },
  {
    question: "Siparişimi iptal edebilir miyim?",
    answer:
      "Sipariş “Onay bekliyor” veya “Hazırlanıyor” durumundayken uygulamadan tek dokunuşla iptal edebilirsin. Kurye yola çıktıktan sonra iptal için canlı destekten bize ulaşman gerekir.",
  },
  {
    question: "İadem ne zaman hesabıma geçer?",
    answer:
      "Online ödemeli siparişlerde iptal edilen tutar anında Sofra Cüzdan bakiyene yansır ve bir sonraki siparişinde kullanılabilir. Kredi kartına iade talep edersen banka sürecine bağlı olarak 1-7 iş günü sürer.",
  },
  {
    question: "Eksik veya yanlış ürün geldi, ne yapmalıyım?",
    answer:
      "Sipariş detay sayfasından canlı desteğe bağlanıp “Eksik / yanlış ürün” seçeneğini işaretle. Kaydın restorana iletilir, onaylanması hâlinde ürün tutarı cüzdanına iade edilir.",
  },
  {
    question: "Kuryeyi nasıl ararım? Numaram görünür mü?",
    answer:
      "Kurye atandıktan sonra takip ekranındaki “Ara” düğmesiyle maskeli hat üzerinden görüşebilirsin. Gerçek numaran kuryeye, kuryenin numarası da sana gösterilmez.",
  },
  {
    question: "Minimum sepet tutarı neden var?",
    answer:
      "Her restoran kendi minimum sepet tutarını belirler. Sepetin bu tutarın altındayken ödeme adımına geçemezsin; sepet sayfasında ne kadar eksik olduğunu görebilirsin.",
  },
  {
    question: "Hangi ödeme yöntemlerini kullanabilirim?",
    answer:
      "Online kredi/banka kartı, Sofra Cüzdan, yemek kartları (Multinet, Sodexo, Ticket, Setcard, Metropol) ve kapıda nakit/kredi kartı. Restoranın kabul ettiği yöntemler ödeme adımında listelenir.",
  },
];

/** Destek sayfası: sık sorulan sorular + canlı asistan. */
export function SupportPageClient() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 lg:px-6 lg:pt-8">
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          Yardım &amp; canlı destek
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Sık sorulan soruların yanıtlarına göz at ya da asistanımıza yaz.
          Çözemezsek seni bir müşteri temsilcisine aktarırız.
        </p>
      </header>

      {/* `grid-cols-1`: hızlı yanıt rayı mobilde sütunu genişletmesin */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-8">
        <section className="min-w-0">
          <h2 className="mb-4 text-lg font-extrabold text-text">
            Sıkça sorulan sorular
          </h2>
          <ul className="card divide-y divide-border overflow-hidden">
            {FAQ.map((item, index) => {
              const open = openIndex === index;
              return (
                <li key={item.question}>
                  <button
                    type="button"
                    onClick={() => setOpenIndex(open ? null : index)}
                    aria-expanded={open}
                    className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-surface-2"
                  >
                    <span className="min-w-0 flex-1 font-semibold text-text">
                      {item.question}
                    </span>
                    <ChevronDown
                      className={cn(
                        "size-5 shrink-0 text-muted transition-transform",
                        open && "rotate-180"
                      )}
                    />
                  </button>
                  {open && (
                    <p className="animate-fade-up px-5 pb-4 text-sm leading-relaxed text-muted">
                      {item.answer}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <aside className="min-w-0">
          <div className="card sticky top-24 flex h-[620px] flex-col p-4 sm:p-5">
            <div className="mb-2 border-b border-border pb-3">
              <h2 className="font-extrabold text-text">Sofra Asistanı</h2>
              <p className="text-xs text-muted">
                Ortalama yanıt süresi: birkaç saniye
              </p>
            </div>
            <ChatPanel className="min-h-0 flex-1" />
          </div>
        </aside>
      </div>
    </div>
  );
}
