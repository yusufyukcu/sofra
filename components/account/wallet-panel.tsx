"use client";

import { ArrowDownLeft, ArrowUpRight, Plus, Wallet } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api-client";
import { useSession } from "@/lib/store/session";
import { formatDateTime, formatPrice } from "@/lib/utils";
import { Modal } from "@/components/ui/modal";
import {
  Button,
  Chip,
  EmptyState,
  Field,
  Input,
  Skeleton,
} from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";

interface Transaction {
  id: string;
  type: "spend" | "refund" | "topup" | "credit" | "debit" | "tip";
  /** Bakiyeye giriş mi çıkış mı */
  direction: "in" | "out";
  amount: number;
  balanceAfter: number;
  label: string;
  at: string;
  orderId?: string;
}

const QUICK_AMOUNTS = [100, 250, 500, 1000];

/** Platform cüzdanı: bakiye, hareketler ve bakiye yükleme. */
export function WalletPanel() {
  const toast = useToast();
  const user = useSession((s) => s.user);
  const setUser = useSession((s) => s.setUser);

  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [amount, setAmount] = useState(250);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get<{ balance: number; transactions: Transaction[] }>("/wallet")
      .then((data) => setTransactions(data.transactions))
      .catch(() => setTransactions([]));
  }, []);

  async function topUp() {
    setSaving(true);
    try {
      const data = await api.post<{ balance: number; transactions: Transaction[] }>("/wallet", {
        amount,
      });
      if (user) setUser({ ...user, walletBalance: data.balance });
      setTransactions(data.transactions);
      toast.success(`${formatPrice(amount)} yüklendi.`);
      setTopUpOpen(false);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (!user) return null;

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">Cüzdanım</h1>
        <p className="mt-1 text-sm text-muted">
          Bakiyeni gör, yükle ve harcamalarını takip et.
        </p>
      </header>

      <section
        className="relative overflow-hidden rounded-2xl p-6 text-white shadow-soft"
        style={{
          backgroundImage: "linear-gradient(125deg, #1f2937, #0f172a 60%, #312e2b)",
        }}
      >
        <Wallet className="absolute -right-4 -top-4 size-32 opacity-10" />
        <p className="text-sm font-medium text-white/70">Kullanılabilir bakiye</p>
        <p className="mt-1 text-4xl font-extrabold tracking-tight">
          {formatPrice(user.walletBalance)}
        </p>
        <p className="mt-3 max-w-md text-xs leading-relaxed text-white/60">
          İptal ettiğin online ödemeli siparişlerin tutarı anında cüzdanına iade
          edilir ve bir sonraki siparişinde kullanılabilir.
        </p>
        <Button
          className="mt-4 bg-white text-black hover:bg-white/90"
          onClick={() => setTopUpOpen(true)}
        >
          <Plus className="size-4" />
          Bakiye yükle
        </Button>
      </section>

      <section className="card overflow-hidden">
        <h2 className="border-b border-border px-5 py-3.5 font-extrabold text-text">
          Hareketler
        </h2>

        {!transactions ? (
          <div className="space-y-2 p-5">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-5">
            <EmptyState
              emoji="💸"
              title="Henüz hareket yok"
              description="Bakiye yüklediğinde, cüzdanla ödediğinde ya da iade aldığında burada görünecek."
            />
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {transactions.map((item) => {
              const incoming = item.direction === "in";
              const body = (
                <>
                  <span
                    className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
                      incoming ? "bg-success-soft text-success" : "bg-surface-2 text-muted"
                    }`}
                  >
                    {incoming ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-text">{item.label}</span>
                    <span className="block text-xs text-muted">
                      {formatDateTime(item.at)} · Bakiye {formatPrice(item.balanceAfter)}
                    </span>
                  </span>
                  <span className={`tabular shrink-0 font-extrabold ${incoming ? "text-success" : "text-text"}`}>
                    {incoming ? "+" : "−"}
                    {formatPrice(item.amount)}
                  </span>
                </>
              );
              return (
                <li key={item.id}>
                  {item.orderId ? (
                    <Link
                      href={`/siparis/${item.orderId}`}
                      className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-surface-2"
                    >
                      {body}
                    </Link>
                  ) : (
                    <div className="flex items-center gap-3 px-5 py-3.5">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Modal
        open={topUpOpen}
        onClose={() => setTopUpOpen(false)}
        title="Bakiye yükle"
        description="Prototipte ödeme geçidi simüle edilir, gerçek tahsilat yapılmaz."
        size="sm"
        footer={
          <Button block size="lg" loading={saving} onClick={topUp}>
            {formatPrice(amount)} yükle
          </Button>
        }
      >
        <div className="space-y-4 pt-1">
          <div className="flex flex-wrap gap-2">
            {QUICK_AMOUNTS.map((value) => (
              <Chip
                key={value}
                active={amount === value}
                onClick={() => setAmount(value)}
              >
                {formatPrice(value)}
              </Chip>
            ))}
          </div>

          <Field label="Tutar" hint="En fazla 5.000 ₺">
            <Input
              type="number"
              min={1}
              max={5000}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
