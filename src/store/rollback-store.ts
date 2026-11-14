import { create } from "zustand";
import { ubusClient } from "@/lib/ubus-client";

interface RollbackStoreState {
  isArmed: boolean;
  token: string | null;
  timeout: number;
  secondsRemaining: number;
  isModalOpen: boolean;
  isApplying: boolean;
  error: string | null;
  timerId: ReturnType<typeof setInterval> | null;

  arm: (timeout?: number) => Promise<boolean>;
  confirm: () => Promise<boolean>;
  rollbackNow: () => Promise<boolean>;
  closeModal: () => void;
}

export const useRollbackStore = create<RollbackStoreState>((set, get) => ({
  isArmed: false,
  token: null,
  timeout: 75,
  secondsRemaining: 75,
  isModalOpen: false,
  isApplying: false,
  error: null,
  timerId: null,

  arm: async (timeout = 75) => {
    // Clear existing timer if any
    const existingTimer = get().timerId;
    if (existingTimer) clearInterval(existingTimer);

    try {
      const res = await ubusClient.armRollback(timeout);
      const token = res.token || "token_" + Date.now();
      const actualTimeout = res.timeout || timeout;

      set({
        isArmed: true,
        token,
        timeout: actualTimeout,
        secondsRemaining: actualTimeout,
        isModalOpen: true,
        error: null,
      });

      const timer = setInterval(() => {
        const { secondsRemaining, isArmed, timerId } = get();
        if (!isArmed || secondsRemaining <= 1) {
          if (timerId) clearInterval(timerId);
          set({
            secondsRemaining: 0,
            isArmed: false,
            timerId: null,
            error: "Watchdog timer expired! Router configurations restored to safe state.",
          });
        } else {
          set({ secondsRemaining: secondsRemaining - 1 });
        }
      }, 1000);

      set({ timerId: timer });
      return true;
    } catch (e: any) {
      set({ error: e?.message || "Failed to arm rollback watchdog" });
      return false;
    }
  },

  confirm: async () => {
    const { token, timerId } = get();
    if (timerId) clearInterval(timerId);
    set({ isApplying: true });
    try {
      await ubusClient.confirmRollback(token || undefined);
      set({
        isArmed: false,
        token: null,
        isModalOpen: false,
        isApplying: false,
        timerId: null,
        error: null,
      });
      return true;
    } catch (e: any) {
      set({ isApplying: false, error: e?.message || "Failed to confirm changes" });
      return false;
    }
  },

  rollbackNow: async () => {
    const { timerId } = get();
    if (timerId) clearInterval(timerId);
    set({ isApplying: true });
    try {
      await ubusClient.cancelRollback();
      set({
        isArmed: false,
        token: null,
        isModalOpen: false,
        isApplying: false,
        timerId: null,
        error: null,
      });
      return true;
    } catch (e: any) {
      set({ isApplying: false, error: e?.message || "Failed to trigger rollback" });
      return false;
    }
  },

  closeModal: () => {
    // Cannot close modal while armed without confirming or rolling back
    if (!get().isArmed) {
      set({ isModalOpen: false });
    }
  },
}));