// ORBIX Captive Portal Zustand Store
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { captivePortalManager } from "@/services/captive/captive-manager";
import { certManager } from "@/services/captive/cert-manager";
import {
  CaptivePortalConfig,
  CaptivePortalStatus,
  CaptiveClient,
  CertificateStatus,
  DiagnosticCheck,
  CaptiveEvent,
  CaptivePortalMode,
} from "@/types/captive";

interface CaptiveState {
  config: CaptivePortalConfig;
  status: CaptivePortalStatus | null;
  clients: CaptiveClient[];
  certStatus: CertificateStatus | null;
  diagnostics: DiagnosticCheck[];
  events: CaptiveEvent[];
  activeTab: string;
  isLoading: boolean;
  isSaving: boolean;
  isRunningDiagnostics: boolean;
  error: string | null;

  // Actions
  setActiveTab: (tab: string) => void;
  loadAll: () => Promise<void>;
  updateConfig: (updates: Partial<CaptivePortalConfig>) => void;
  saveConfig: () => Promise<{ success: boolean; message: string }>;
  setMode: (mode: CaptivePortalMode) => Promise<{ success: boolean; message: string }>;
  refreshClients: () => Promise<void>;
  toggleClientExemption: (ip: string) => Promise<void>;
  refreshCertStatus: () => Promise<void>;
  renewCertificate: () => Promise<{ success: boolean; message: string }>;
  uploadCertificate: (
    cert: string,
    key: string,
    domain?: string
  ) => Promise<{ success: boolean; message: string }>;
  runDiagnostics: () => Promise<void>;
  addEvent: (event: Omit<CaptiveEvent, "id" | "timestamp">) => void;
  clearEvents: () => void;
}

const DEFAULT_CONFIG: CaptivePortalConfig = {
  enabled: true,
  mode: "captive_portal",
  portal_domain: "orbix.lan",
  portal_ssl_port: 443,
  http_intercept: true,
  rfc8908_enabled: true,
  dhcp_opt114: true,
  ra_opt103: true,
  session_timeout_sec: 7200,
  exempt_ips: [],
  exempt_macs: [],
  cert_mode: "private_ca",
  acme_provider: "cloudflare",
  dns_provider: "cloudflare",
};

export const useCaptiveStore = create<CaptiveState>()(
  persist(
    (set, get) => ({
      config: DEFAULT_CONFIG,
      status: null,
      clients: [],
      certStatus: null,
      diagnostics: [],
      events: [
        {
          id: "evt_init_1",
          timestamp: Date.now() - 3600000,
          type: "state_change",
          details: "Captive Portal initialized with RFC 8908 API and HTTP 307 interception",
        },
        {
          id: "evt_init_2",
          timestamp: Date.now() - 1800000,
          type: "cert_renew",
          details: "TLS Certificate verified for orbix.lan and router IP endpoints",
        },
      ],
      activeTab: "overview",
      isLoading: false,
      isSaving: false,
      isRunningDiagnostics: false,
      error: null,

      setActiveTab: (tab) => set({ activeTab: tab }),

      loadAll: async () => {
        set({ isLoading: true, error: null });
        try {
          const [cfg, stat, cls, certs, diags] = await Promise.all([
            captivePortalManager.getConfig(),
            captivePortalManager.getStatus(),
            captivePortalManager.getClients(),
            certManager.getStatus(),
            captivePortalManager.runDiagnostics(),
          ]);

          set({
            config: cfg,
            status: stat,
            clients: cls,
            certStatus: certs,
            diagnostics: diags,
            isLoading: false,
          });
        } catch (e: any) {
          set({ isLoading: false, error: e?.message || "Failed to load captive portal status" });
        }
      },

      updateConfig: (updates) => {
        set({ config: { ...get().config, ...updates } });
      },

      saveConfig: async () => {
        set({ isSaving: true, error: null });
        try {
          const res = await captivePortalManager.saveConfig(get().config);
          await get().loadAll();
          set({ isSaving: false });
          get().addEvent({
            type: "state_change",
            details: `Captive Portal config updated (Mode: ${get().config.mode.toUpperCase()})`,
          });
          return res;
        } catch (e: any) {
          set({ isSaving: false, error: e?.message || "Save failed" });
          return { success: false, message: e?.message || "Failed to save" };
        }
      },

      setMode: async (mode) => {
        get().updateConfig({ mode });
        return get().saveConfig();
      },

      refreshClients: async () => {
        try {
          const cls = await captivePortalManager.getClients();
          set({ clients: cls });
        } catch {
          // ignore
        }
      },

      toggleClientExemption: async (ip: string) => {
        const client = get().clients.find((c) => c.ip === ip);
        const shouldExempt = !client?.is_exempt;
        const currentExemptIps = get().config.exempt_ips || [];

        let nextExemptIps: string[];
        if (shouldExempt) {
          nextExemptIps = Array.from(new Set([...currentExemptIps, ip]));
        } else {
          nextExemptIps = currentExemptIps.filter((item) => item !== ip);
        }

        get().updateConfig({ exempt_ips: nextExemptIps });
        await captivePortalManager.setClientExemption(ip, shouldExempt);
        await get().refreshClients();

        get().addEvent({
          type: "exemption",
          client_ip: ip,
          details: `Client ${ip} exemption ${shouldExempt ? "granted" : "revoked"}`,
        });
      },

      refreshCertStatus: async () => {
        try {
          const c = await certManager.getStatus();
          set({ certStatus: c });
        } catch {
          // ignore
        }
      },

      renewCertificate: async () => {
        set({ isSaving: true });
        try {
          const res = await certManager.renewCertificate();
          await get().refreshCertStatus();
          set({ isSaving: false });
          get().addEvent({
            type: "cert_renew",
            details: res.message,
          });
          return res;
        } catch (e: any) {
          set({ isSaving: false });
          return { success: false, message: e?.message || "Renewal failed" };
        }
      },

      uploadCertificate: async (cert, key, domain) => {
        set({ isSaving: true });
        try {
          const res = await certManager.uploadCustomCertificate(cert, key, domain);
          await get().refreshCertStatus();
          set({ isSaving: false });
          get().addEvent({
            type: "cert_renew",
            details: `Custom TLS certificate uploaded for ${domain || "portal"}`,
          });
          return res;
        } catch (e: any) {
          set({ isSaving: false });
          return { success: false, message: e?.message || "Upload failed" };
        }
      },

      runDiagnostics: async () => {
        set({ isRunningDiagnostics: true });
        try {
          const diags = await captivePortalManager.runDiagnostics();
          set({ diagnostics: diags, isRunningDiagnostics: false });
        } catch {
          set({ isRunningDiagnostics: false });
        }
      },

      addEvent: (ev) => {
        const newEv: CaptiveEvent = {
          ...ev,
          id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          timestamp: Date.now(),
        };
        set({ events: [newEv, ...get().events].slice(0, 50) });
      },

      clearEvents: () => set({ events: [] }),
    }),
    {
      name: "orbix_captive_portal_storage_v1",
      partialize: (state) => ({
        events: state.events,
        activeTab: state.activeTab,
      }),
    }
  )
);
