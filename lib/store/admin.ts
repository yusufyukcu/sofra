"use client";

import { create } from "zustand";
import { api } from "../api-client";
import type { AdminOverview } from "../services/admin";

/**
 * Yönetici paneli oturumu.
 * Diğer üç oturumdan bağımsızdır; dördü aynı tarayıcıda açık kalabilir.
 */

export interface AdminProfile {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

interface AdminState {
  status: "loading" | "authenticated" | "guest";
  admin: AdminProfile | null;
  kpi: AdminOverview["kpi"] | null;

  bootstrap: () => Promise<void>;
  applyAuth: (admin: AdminProfile) => void;
  logout: () => Promise<void>;
  setKpi: (kpi: AdminOverview["kpi"]) => void;
}

export const useAdmin = create<AdminState>()((set) => ({
  status: "loading",
  admin: null,
  kpi: null,

  bootstrap: async () => {
    try {
      const data = await api.get<{
        admin: AdminProfile;
        kpi: AdminOverview["kpi"];
      }>("/admin/auth/me");
      set({ status: "authenticated", admin: data.admin, kpi: data.kpi });
    } catch {
      set({ status: "guest", admin: null, kpi: null });
    }
  },

  applyAuth: (admin) => set({ status: "authenticated", admin }),

  logout: async () => {
    try {
      await api.post("/admin/auth/logout");
    } finally {
      set({ status: "guest", admin: null, kpi: null });
    }
  },

  setKpi: (kpi) => set({ kpi }),
}));
