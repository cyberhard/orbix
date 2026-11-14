import { create } from "zustand";
import { ubusClient } from "@/lib/ubus-client";
import { useRollbackStore } from "@/store/rollback-store";

export interface StagedChange {
  config: string;
  section: string;
  option: string;
  oldValue: unknown;
  newValue: unknown;
  type: "set" | "add" | "delete";
}

interface UciState {
  pendingCount: number;
  changes: Record<string, Record<string, unknown>>;
  isDiffOpen: boolean;
  isApplying: boolean;
  applyProgress: string | null;
  fetchChanges: () => Promise<void>;
  stageChange: (change: StagedChange) => Promise<void>;
  commitAndApply: () => Promise<boolean>;
  revertAll: () => Promise<boolean>;
  setDiffOpen: (open: boolean) => void;
}

export const useUciStore = create<UciState>((set, get) => ({
  pendingCount: 0,
  changes: {},
  isDiffOpen: false,
  isApplying: false,
  applyProgress: null,

  fetchChanges: async () => {
    try {
      const res = await ubusClient.getUciChanges();
      let count = 0;
      if (res && typeof res === "object") {
        for (const config of Object.keys(res)) {
          const cfg = (res as Record<string, unknown>)[config];
          if (Array.isArray(cfg)) {
            count += cfg.length;
          } else if (cfg && typeof cfg === "object") {
            count += Object.keys(cfg).length;
          }
        }
      }
      set({ changes: res as Record<string, Record<string, unknown>>, pendingCount: count });
    } catch (e) {
      console.warn("Failed to fetch UCI changes:", e);
    }
  },

  stageChange: async ({ config, section, option, newValue }) => {
    try {
      await ubusClient.setUci(config, section, { [option]: newValue });
      await get().fetchChanges();
    } catch (e) {
      console.error("Failed to stage UCI change:", e);
      throw e;
    }
  },

  commitAndApply: async () => {
    set({ isApplying: true, applyProgress: "Arming safety watchdog and committing..." });
    try {
      // 1. Arm safety rollback watchdog on OpenWrt
      await useRollbackStore.getState().arm(75);

      // 2. Commit UCI changes
      set({ applyProgress: "Committing changes to /etc/config..." });
      await ubusClient.commitUci();

      // 3. Apply changes and reload network services
      set({ applyProgress: "Applying changes and reloading network services..." });
      await ubusClient.applyUci(true, 30);

      set({ isApplying: false, applyProgress: null, pendingCount: 0, changes: {}, isDiffOpen: false });
      return true;
    } catch (e) {
      console.error("Apply failed:", e);
      set({ isApplying: false, applyProgress: null });
      return false;
    }
  },

  revertAll: async () => {
    set({ isApplying: true, applyProgress: "Reverting all staged changes..." });
    try {
      await ubusClient.revertUci();
      set({ isApplying: false, applyProgress: null, pendingCount: 0, changes: {}, isDiffOpen: false });
      return true;
    } catch (e) {
      console.error("Revert failed:", e);
      set({ isApplying: false, applyProgress: null });
      return false;
    }
  },

  setDiffOpen: (open: boolean) => set({ isDiffOpen: open }),
}));
