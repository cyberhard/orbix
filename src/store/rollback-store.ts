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
  restoreSessionIfActive: () => void;
}

const STORAGE_KEY = "orbix_rollback_session";

interface StoredSession {
  token: string;
  armedAt: number;
  timeout: number;
}

const getStoredSession = (): StoredSession | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const saveStoredSession = (session: StoredSession | null) => {
  if (typeof window === "undefined") return;
  try {
    if (session) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Ignore storage quota
  }
};

export const useRollbackStore = create<RollbackStoreState>((set, get) => {
  // Initialize timer loop helper
  const startTimerLoop = () => {
    const existing = get().timerId;
    if (existing) clearInterval(existing);

    const timer = setInterval(() => {
      const { secondsRemaining, isArmed, timerId } = get();
      if (!isArmed || secondsRemaining <= 1) {
        if (timerId) clearInterval(timerId);
        saveStoredSession(null);
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
  };

  // Restore on boot if session is still valid in sessionStorage
  const initStored = getStoredSession();
  let initialArmed = false;
  let initialToken: string | null = null;
  let initialRemaining = 75;
  let initialTimeout = 75;

  if (initStored && initStored.token) {
    const elapsed = Math.floor((Date.now() - initStored.armedAt) / 1000);
    const left = initStored.timeout - elapsed;
    if (left > 0) {
      initialArmed = true;
      initialToken = initStored.token;
      initialRemaining = left;
      initialTimeout = initStored.timeout;
    } else {
      saveStoredSession(null);
    }
  }

  return {
    isArmed: initialArmed,
    token: initialToken,
    timeout: initialTimeout,
    secondsRemaining: initialRemaining,
    isModalOpen: initialArmed,
    isApplying: false,
    error: null,
    timerId: null,

    restoreSessionIfActive: () => {
      const stored = getStoredSession();
      if (!stored) return;
      const elapsed = Math.floor((Date.now() - stored.armedAt) / 1000);
      const left = stored.timeout - elapsed;
      if (left > 0) {
        set({
          isArmed: true,
          token: stored.token,
          timeout: stored.timeout,
          secondsRemaining: left,
          isModalOpen: true,
        });
        startTimerLoop();
      } else {
        saveStoredSession(null);
      }
    },

    arm: async (timeout = 75) => {
      const existingTimer = get().timerId;
      if (existingTimer) clearInterval(existingTimer);

      try {
        const res = await ubusClient.armRollback(timeout);
        const token = res.token || "token_" + Date.now();
        const actualTimeout = res.timeout || timeout;

        saveStoredSession({
          token,
          armedAt: Date.now(),
          timeout: actualTimeout,
        });

        set({
          isArmed: true,
          token,
          timeout: actualTimeout,
          secondsRemaining: actualTimeout,
          isModalOpen: true,
          error: null,
        });

        startTimerLoop();
        return true;
      } catch (e: any) {
        set({ error: e?.message || "Failed to arm rollback watchdog" });
        return false;
      }
    },

    confirm: async () => {
      const { token, timerId } = get();
      set({ isApplying: true });
      try {
        await ubusClient.confirmRollback(token || undefined);
        if (timerId) clearInterval(timerId);
        saveStoredSession(null);
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
        // Keep timer running if confirmation failed so user can retry or rollback
        set({ isApplying: false, error: e?.message || "Failed to confirm changes" });
        return false;
      }
    },

    rollbackNow: async () => {
      const { timerId } = get();
      set({ isApplying: true });
      try {
        await ubusClient.cancelRollback();
        if (timerId) clearInterval(timerId);
        saveStoredSession(null);
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
      if (!get().isArmed) {
        set({ isModalOpen: false });
      }
    },
  };
});