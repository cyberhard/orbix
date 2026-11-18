// Centralized State Store for First-Run Setup Wizard
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { HardwareDetector, HardwareDetectionResult } from "./hardware-detector";
import { ubusClient } from "@/lib/ubus-client";
import { usePolicyStore } from "@/store/policy-store";
import "@/store/theme-store";
import "@/store/i18n-store";

export type WizardStep =
  | "welcome"
  | "hardware"
  | "network"
  | "wireless"
  | "security"
  | "services"
  | "summary";

export interface WizardDraftConfig {
  setupMode: "simple" | "advanced";

  // Network
  wanProto: "dhcp" | "pppoe" | "static";
  wanPppoeUser?: string;
  wanPppoePassword?: string;
  wanStaticIp?: string;
  wanStaticNetmask?: string;
  wanStaticGateway?: string;
  wanStaticDns?: string;
  lanIp: string;
  lanNetmask: string;

  // Wireless
  wifiEnabled: boolean;
  wifiSsid: string;
  wifiPassword: string;
  wifiBandSteering: boolean;
  guestWifiEnabled: boolean;
  guestWifiSsid?: string;
  guestWifiPassword?: string;

  // Security
  rootPassword: string;
  confirmRootPassword: string;
  disableRemoteSsh: boolean;

  // Core Services
  enableZapretYoutube: boolean;
  enableZapretDiscord: boolean;
  enableRuNetDirect: boolean;
  enableSmartDnsAi: boolean;
  enableVlessVpn: boolean;
  enableKillSwitch: boolean;
}

interface WizardState {
  isOpen: boolean;
  isCompleted: boolean;
  currentStep: WizardStep;
  hardware: HardwareDetectionResult | null;
  isLoadingHardware: boolean;
  draft: WizardDraftConfig;
  isApplying: boolean;
  applyProgress: string | null;
  error: string | null;

  // Actions
  openWizard: () => void;
  closeWizard: () => void;
  setStep: (step: WizardStep) => void;
  setSetupMode: (mode: "simple" | "advanced") => void;
  updateDraft: (updates: Partial<WizardDraftConfig>) => void;
  loadHardware: () => Promise<void>;
  applyWizard: () => Promise<{ success: boolean; rollbackToken?: string; message: string }>;
  markCompleted: () => void;
}

const DEFAULT_DRAFT: WizardDraftConfig = {
  setupMode: "simple",
  wanProto: "dhcp",
  lanIp: "192.168.1.1",
  lanNetmask: "255.255.255.0",
  wifiEnabled: true,
  wifiSsid: "OpenWrt-Home",
  wifiPassword: "ChangeMe2026!",
  wifiBandSteering: true,
  guestWifiEnabled: false,
  guestWifiSsid: "OpenWrt-Guest",
  guestWifiPassword: "GuestPass2026!",
  rootPassword: "",
  confirmRootPassword: "",
  disableRemoteSsh: true,
  enableZapretYoutube: true,
  enableZapretDiscord: true,
  enableRuNetDirect: true,
  enableSmartDnsAi: true,
  enableVlessVpn: true,
  enableKillSwitch: false,
};

export const useWizardStore = create<WizardState>()(
  persist(
    (set, get) => ({
      isOpen: false,
      isCompleted: false,
      currentStep: "welcome",
      hardware: null,
      isLoadingHardware: false,
      draft: DEFAULT_DRAFT,
      isApplying: false,
      applyProgress: null,
      error: null,

      openWizard: () => {
        set({ isOpen: true, currentStep: "welcome", error: null });
        get().loadHardware();
      },

      closeWizard: () => set({ isOpen: false }),

      setStep: (step) => set({ currentStep: step }),

      setSetupMode: (mode) =>
        set((state) => ({
          draft: { ...state.draft, setupMode: mode },
        })),

      updateDraft: (updates) =>
        set((state) => ({
          draft: { ...state.draft, ...updates },
        })),

      loadHardware: async () => {
        set({ isLoadingHardware: true });
        try {
          const hw = await HardwareDetector.detect();
          set({
            hardware: hw,
            isLoadingHardware: false,
            draft: {
              ...get().draft,
              lanIp: hw.network.detectedLanIp || "192.168.1.1",
              wanProto: (hw.network.detectedWanProto as any) || "dhcp",
              wifiSsid: hw.wireless.radios[0]?.ssid || "OpenWrt-Home",
            },
          });
        } catch (e: any) {
          set({ isLoadingHardware: false, error: e.message });
        }
      },

      markCompleted: () => set({ isCompleted: true, isOpen: false }),

      applyWizard: async () => {
        const { draft, hardware } = get();
        set({ isApplying: true, applyProgress: "Подготовка транзакции...", error: null });

        try {
          // 1. Arm rollback watchdog
          set({ applyProgress: "Активация сторожевого таймера отката (75 сек)..." });
          const armRes = await ubusClient.armRollback(75);
          const rollbackToken = armRes.token || "token";

          // 2. Set Admin Password if provided
          if (draft.rootPassword) {
            set({ applyProgress: "Установка пароля администратора..." });
            await ubusClient.setRootPassword(draft.rootPassword);
          }

          // 3. Configure Dropbear SSH
          if (draft.disableRemoteSsh) {
            await ubusClient.setUci("dropbear", "@dropbear[0]", {
              GatewayPorts: "off",
              Interface: "lan", // Bind strictly to LAN
            });
            await ubusClient.commitUci("dropbear");
          }

          // 4. Configure WAN & LAN if changed
          set({ applyProgress: "Применение настроек сети..." });
          if (draft.wanProto === "pppoe" && draft.wanPppoeUser && draft.wanPppoePassword) {
            await ubusClient.setUci("network", "wan", {
              proto: "pppoe",
              username: draft.wanPppoeUser,
              password: draft.wanPppoePassword,
            });
          } else if (draft.wanProto === "static" && draft.wanStaticIp) {
            await ubusClient.setUci("network", "wan", {
              proto: "static",
              ipaddr: draft.wanStaticIp,
              netmask: draft.wanStaticNetmask || "255.255.255.0",
              gateway: draft.wanStaticGateway,
              dns: draft.wanStaticDns ? [draft.wanStaticDns] : ["77.88.8.8", "1.1.1.1"],
            });
          }

          // LAN Subnet
          if (draft.lanIp && draft.lanIp !== hardware?.network.detectedLanIp) {
            await ubusClient.setUci("network", "lan", {
              ipaddr: draft.lanIp,
              netmask: draft.lanNetmask,
            });
          }
          await ubusClient.commitUci("network");

          // 5. Configure Wi-Fi
          if (draft.wifiEnabled && hardware?.wireless.hasWireless) {
            set({ applyProgress: "Применение настроек беспроводной сети Wi-Fi..." });
            for (const radio of hardware.wireless.radios) {
              await ubusClient.saveWifiRadio(radio.device, `default_${radio.device}`, {
                ssid: draft.wifiSsid,
                key: draft.wifiPassword,
                encryption: "psk2",
                disabled: false,
              });
            }
          }

          // 6. Apply Core Policies
          set({ applyProgress: "Компиляция политик маршрутизации и обхода..." });
          const policyStore = usePolicyStore.getState();
          policyStore.setOperatingMode(draft.setupMode === "advanced" ? "expert" : "simple");

          // Update YouTube Zapret policy toggle
          const ytPol = policyStore.policies.find((p) => p.id === "sys-policy-youtube-zapret");
          if (ytPol && ytPol.enabled !== draft.enableZapretYoutube) {
            policyStore.togglePolicy(ytPol.id);
          }

          // Update Discord Zapret policy toggle
          const dcPol = policyStore.policies.find((p) => p.id === "sys-policy-discord-zapret");
          if (dcPol && dcPol.enabled !== draft.enableZapretDiscord) {
            policyStore.togglePolicy(dcPol.id);
          }

          // Apply policies to sing-box / zapret / dnsmasq
          await policyStore.applyPoliciesToRouter();

          // Mark completed
          get().markCompleted();
          set({ isApplying: false, applyProgress: null });

          return {
            success: true,
            rollbackToken,
            message: "Первоначальная настройка успешно завершена!",
          };
        } catch (err: any) {
          set({ isApplying: false, applyProgress: null, error: err.message });
          throw err;
        }
      },
    }),
    {
      name: "openwrt_wizard_storage",
      partialize: (state) => ({
        isCompleted: state.isCompleted,
      }),
    }
  )
);
