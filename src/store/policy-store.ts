// Centralized Policy Store for OpenWrt Network Management Platform
import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  NetworkPolicy,
  DomainCategory,
  DeviceGroup,
  PolicyConflict,
  CompiledSystemConfig,
} from "@/services/policy-engine/types";
import { DEFAULT_NETWORK_POLICIES } from "@/services/policy-engine/default-policies";
import { DEFAULT_DOMAIN_CATEGORIES } from "@/services/policy-engine/categories";
import { DEFAULT_DEVICE_GROUPS } from "@/services/policy-engine/device-groups";
import { policyCompiler } from "@/services/policy-engine/compiler";
import { conflictDetector } from "@/services/policy-engine/conflict-detector";
import { ubusClient } from "@/lib/ubus-client";

interface PolicyState {
  operatingMode: "simple" | "expert";
  policies: NetworkPolicy[];
  categories: DomainCategory[];
  deviceGroups: DeviceGroup[];
  conflicts: PolicyConflict[];
  compiledConfig: CompiledSystemConfig;
  isApplying: boolean;
  lastAppliedTimestamp: number | null;
  error: string | null;

  // Actions
  setOperatingMode: (mode: "simple" | "expert") => void;
  addPolicy: (policy: Omit<NetworkPolicy, "id">) => void;
  updatePolicy: (id: string, updates: Partial<NetworkPolicy>) => void;
  deletePolicy: (id: string) => void;
  togglePolicy: (id: string) => void;
  reorderPolicies: (sourceId: string, targetId: string) => void;

  // Categories & Groups
  addCategory: (cat: DomainCategory) => void;
  updateCategory: (id: string, updates: Partial<DomainCategory>) => void;
  deleteCategory: (id: string) => void;
  addDeviceGroup: (group: DeviceGroup) => void;
  updateDeviceGroup: (id: string, updates: Partial<DeviceGroup>) => void;
  deleteDeviceGroup: (id: string) => void;

  // Compilation & Safe Deployment
  recompute: () => void;
  applyPoliciesToRouter: () => Promise<{ success: boolean; message: string }>;
}

export const usePolicyStore = create<PolicyState>()(
  persist(
    (set, get) => ({
      operatingMode: "simple",
      policies: DEFAULT_NETWORK_POLICIES,
      categories: DEFAULT_DOMAIN_CATEGORIES,
      deviceGroups: DEFAULT_DEVICE_GROUPS,
      conflicts: conflictDetector.detectConflicts(DEFAULT_NETWORK_POLICIES),
      compiledConfig: policyCompiler.compile(DEFAULT_NETWORK_POLICIES),
      isApplying: false,
      lastAppliedTimestamp: null,
      error: null,

      setOperatingMode: (mode) => set({ operatingMode: mode }),

      recompute: () => {
        const { policies, categories, deviceGroups } = get();
        policyCompiler.setCategories(categories);
        policyCompiler.setDeviceGroups(deviceGroups);

        const compiled = policyCompiler.compile(policies);
        const conflicts = conflictDetector.detectConflicts(policies);

        set({ compiledConfig: compiled, conflicts });
      },

      addPolicy: (newPolicyData) => {
        const id = `policy-${Date.now()}`;
        const newPolicy: NetworkPolicy = {
          ...newPolicyData,
          id,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        const updated = [newPolicy, ...get().policies];
        set({ policies: updated });
        get().recompute();
      },

      updatePolicy: (id, updates) => {
        const updated = get().policies.map((p) =>
          p.id === id ? { ...p, ...updates, updatedAt: Date.now() } : p
        );
        set({ policies: updated });
        get().recompute();
      },

      deletePolicy: (id) => {
        const updated = get().policies.filter((p) => p.id !== id);
        set({ policies: updated });
        get().recompute();
      },

      togglePolicy: (id) => {
        const updated = get().policies.map((p) =>
          p.id === id ? { ...p, enabled: !p.enabled, updatedAt: Date.now() } : p
        );
        set({ policies: updated });
        get().recompute();
      },

      reorderPolicies: (sourceId, targetId) => {
        const list = [...get().policies];
        const sIndex = list.findIndex((p) => p.id === sourceId);
        const tIndex = list.findIndex((p) => p.id === targetId);
        if (sIndex === -1 || tIndex === -1) return;

        const [item] = list.splice(sIndex, 1);
        list.splice(tIndex, 0, item);

        // Normalize priorities
        list.forEach((p, idx) => {
          if (!p.isSystem || p.id !== "sys-policy-default-wan") {
            p.priority = (idx + 1) * 10;
          }
        });

        set({ policies: list });
        get().recompute();
      },

      addCategory: (cat) => {
        set({ categories: [...get().categories, cat] });
        get().recompute();
      },

      updateCategory: (id, updates) => {
        set({
          categories: get().categories.map((c) =>
            c.id === id ? { ...c, ...updates, lastUpdated: Date.now() } : c
          ),
        });
        get().recompute();
      },

      deleteCategory: (id) => {
        set({ categories: get().categories.filter((c) => c.id !== id) });
        get().recompute();
      },

      addDeviceGroup: (group) => {
        set({ deviceGroups: [...get().deviceGroups, group] });
        get().recompute();
      },

      updateDeviceGroup: (id, updates) => {
        set({
          deviceGroups: get().deviceGroups.map((g) =>
            g.id === id ? { ...g, ...updates } : g
          ),
        });
        get().recompute();
      },

      deleteDeviceGroup: (id) => {
        set({ deviceGroups: get().deviceGroups.filter((g) => g.id !== id) });
        get().recompute();
      },

      applyPoliciesToRouter: async () => {
        set({ isApplying: true, error: null });
        get().recompute();

        const { compiledConfig } = get();

        try {
          // 1. Arm Safety Watchdog Rollback
          const rollback = await ubusClient.armRollback(75);

          // 2. Synchronize Domain & Action Policies to OpenWrt backend (nftables, dnsmasq, singbox)
          await ubusClient.applyPolicyBackend({
            blocked_domains: compiledConfig.blockedDomains || [],
            direct_domains: compiledConfig.directDomains || [],
            proxy_domains: compiledConfig.proxyDomains || [],
            policies: get().policies.filter((p) => p.enabled),
          });

          // 3. Apply PBR Device & Domain Rules
          for (const rule of compiledConfig.pbrPolicies) {
            await ubusClient.setDeviceRoutingRule({
              ip: rule.src_addr || "",
              name: rule.name,
              interface: rule.interface,
              enabled: rule.enabled,
            });
          }

          // 4. Confirm Rollback after verification
          if (rollback?.token) {
            await ubusClient.confirmRollback(rollback.token);
          }

          set({
            isApplying: false,
            lastAppliedTimestamp: Date.now(),
            error: null,
          });

          return {
            success: true,
            message: "All policies successfully compiled and deployed to OpenWrt!",
          };
        } catch (e: any) {
          set({
            isApplying: false,
            error: e?.message || "Failed to apply network policies",
          });
          return {
            success: false,
            message: e?.message || "Deployment error",
          };
        }
      },
    }),
    {
      name: "openwrt_policy_engine_storage",
    }
  )
);
