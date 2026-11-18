import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ubusClient } from "@/lib/ubus-client";
import { VlessNode, SubscriptionMetadata, VpnOutboundGroup, KillSwitchConfig } from "@/types/ubus";

const DEFAULT_METADATA: SubscriptionMetadata = {
  profileTitle: "Liberty VPN",
  updateInterval: "12",
  uploadBytes: 0,
  downloadBytes: 0,
  totalBytes: 0,
  expireTimestamp: 0,
  lastUpdated: 0,
  autoUpdateInterval: "24h",
  selectionMode: "manual",
};

const DEFAULT_VPN_GROUPS: VpnOutboundGroup[] = [
  {
    id: "group-europe",
    name: "Europe Fast Path (DE/FI/NL)",
    nameRu: "Европа (Финляндия / Швейцария)",
    mode: "lowest_latency",
    nodeIds: [],
    healthStatus: "healthy",
  },
  {
    id: "group-backup",
    name: "Backup Failover Pool",
    nameRu: "Резервный пул (Failover)",
    mode: "failover",
    nodeIds: [],
    healthStatus: "healthy",
  },
];

interface SubscriptionState {
  url: string;
  decryptedUrl: string;
  apiKey: string;
  metadata: SubscriptionMetadata;
  nodes: VlessNode[];
  activeNodeId: string;
  outboundGroups: VpnOutboundGroup[];
  killSwitch: KillSwitchConfig;
  isSyncing: boolean;
  isTestingLatency: boolean;
  error: string | null;
  rateLimitUntil: number | null;

  // Actions
  setUrl: (url: string) => void;
  setApiKey: (key: string) => void;
  setOutboundGroups: (groups: VpnOutboundGroup[]) => void;
  setKillSwitch: (cfg: KillSwitchConfig) => void;
  syncSubscription: (overrideUrl?: string, overrideKey?: string) => Promise<boolean>;
  setActiveNode: (nodeId: string) => Promise<boolean>;
  setSelectionMode: (mode: "manual" | "auto_best") => Promise<void>;
  setAutoUpdateInterval: (interval: "disabled" | "6h" | "12h" | "24h") => void;
  testAllLatencies: () => Promise<void>;
  deleteNode: (nodeId: string) => void;
  deleteSubscription: () => void;

  // Groups & KillSwitch
  createGroup: (group: Omit<VpnOutboundGroup, "id">) => void;
  updateGroup: (id: string, updates: Partial<VpnOutboundGroup>) => void;
  deleteGroup: (id: string) => void;
  toggleKillSwitch: (enabled?: boolean) => Promise<boolean>;
  setKillSwitchScope: (scope: "all" | "vpn_devices") => Promise<void>;
  hydrateFromRouterCache: () => Promise<boolean>;
}

export const useSubscriptionStore = create<SubscriptionState>()(
  persist(
    (set, get) => ({
      url: "",
      decryptedUrl: "",
      apiKey: "",
      metadata: DEFAULT_METADATA,
      nodes: [],
      activeNodeId: "",
      outboundGroups: DEFAULT_VPN_GROUPS,
      killSwitch: {
        enabled: false,
        scope: "vpn_devices",
        allowLan: true,
      },
      isSyncing: false,
      isTestingLatency: false,
      error: null,
      rateLimitUntil: null,

      setUrl: (url: string) => set({ url }),
      setApiKey: (key: string) => set({ apiKey: key }),
      setOutboundGroups: (groups: VpnOutboundGroup[]) => set({ outboundGroups: groups }),
      setKillSwitch: (cfg: KillSwitchConfig) => set({ killSwitch: cfg }),

      syncSubscription: async (overrideUrl?: string, overrideKey?: string) => {
        const url = (overrideUrl !== undefined ? overrideUrl : get().url).trim();
        const apiKey = (overrideKey !== undefined ? overrideKey : get().apiKey).trim();
        const { rateLimitUntil } = get();

        if (overrideUrl) set({ url: overrideUrl });
        if (overrideKey) set({ apiKey: overrideKey });

        if (rateLimitUntil && Date.now() < rateLimitUntil) {
          const waitSec = Math.ceil((rateLimitUntil - Date.now()) / 1000);
          set({ error: `Rate limited (429). Please wait ${waitSec}s.` });
          return false;
        }

        set({ isSyncing: true, error: null });
        try {
          const res = await ubusClient.subDecryptFetch(url, apiKey);
          if (res.error) {
            set({ isSyncing: false, error: res.error });
            return false;
          }

          // Parse response from Happy Decoder, raw data, or direct server configurations
          let newNodes: VlessNode[] = [];
          let meta = { ...get().metadata };

          const serverList = res.servers || (res.data as any)?.servers || (Array.isArray(res) ? res : undefined);
          if (serverList && Array.isArray(serverList) && serverList.length > 0) {
            // Check if serverList contains configs with outbounds arrays (e.g. Liberty / Xray format)
            const allOutbounds = serverList.flatMap((s: any) => s.outbounds || []);
            const vlessOutbounds = allOutbounds.filter(
              (o: any) => o.protocol === "vless" || o.type === "vless" || o.settings?.vnext
            );
            const itemsToMap = vlessOutbounds.length > 0 ? vlessOutbounds : serverList;

            newNodes = itemsToMap.map((s: any, idx: number) => {
              // Handle full xray/sing-box config format with outbounds
              const ob = s.protocol || s.type ? s : (s.outbounds?.find((o: any) => o.protocol === "vless" || o.type === "vless") || s.outbounds?.[0] || s);
              const vnext = ob?.settings?.vnext?.[0];
              const user = vnext?.users?.[0];
              const reality = ob?.streamSettings?.realitySettings;
              const tls = ob?.streamSettings?.tlsSettings;

              const serverAddr = vnext?.address || ob?.server || s.address || s.server || s.add || "127.0.0.1";
              const serverPort = Number(vnext?.port || ob?.server_port || s.port) || 443;
              const uuid = user?.id || ob?.uuid || s.uuid || s.id || "";
              const flow = user?.flow || ob?.flow || s.flow || "";
              const security = (reality ? "reality" : (ob?.streamSettings?.security || s.security || "reality")) as "none" | "tls" | "reality";
              const sni = reality?.serverName || tls?.serverName || ob?.tls?.server_name || s.sni || s.host || "";
              const fingerprint = reality?.fingerprint || tls?.fingerprint || ob?.tls?.utls?.fingerprint || s.fingerprint || s.fp || "firefox";
              const publicKey = reality?.publicKey || ob?.tls?.reality?.public_key || s.publicKey || s.pbk || "";
              const shortId = reality?.shortId || ob?.tls?.reality?.short_id || s.shortId || s.sid || "";
              const transport = (ob?.streamSettings?.network || ob?.type || s.transport || s.type || s.net || "tcp") as any;

              let rawName = s.remarks || s.name || s.ps || ob?.tag || `Server ${idx + 1}`;
              let displayName = rawName;
              if (rawName.startsWith("proxy-") && rawName.includes("-liberty-nodes-online")) {
                const part = rawName.replace("proxy-", "").replace("-liberty-nodes-online-direct", "");
                displayName = `Liberty Node (${part})`;
              }

              return {
                id: s.uuid || s.id || ob?.tag || `node-${idx + 1}`,
                name: displayName,
                server: serverAddr,
                port: serverPort,
                uuid: uuid,
                security: security,
                sni: sni,
                fingerprint: fingerprint,
                publicKey: publicKey,
                shortId: shortId,
                transport: transport,
                flow: flow,
                latency: s.latency || 0,
                active: idx === 0,
                country: s.country || "",
              };
            });
          } else if (res.raw) {
            let rawText = res.raw.trim();
            try {
              rawText = atob(rawText);
            } catch {}
            const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
            newNodes = lines
              .map((line, idx) => {
                if (line.startsWith("vless://")) {
                  try {
                    const urlObj = new URL(line);
                    const uuid = urlObj.username;
                    const server = urlObj.hostname;
                    const port = parseInt(urlObj.port, 10) || 443;
                    const params = urlObj.searchParams;
                    const name = decodeURIComponent(urlObj.hash.replace(/^#/, "")) || `Server ${idx + 1}`;
                    return {
                      id: `node-${idx + 1}`,
                      name,
                      server,
                      port,
                      uuid,
                      security: (params.get("security") || "reality") as any,
                      sni: params.get("sni") || params.get("host") || "",
                      fingerprint: params.get("fp") || "firefox",
                      publicKey: params.get("pbk") || "",
                      shortId: params.get("sid") || "",
                      transport: (params.get("type") || "tcp") as any,
                      flow: params.get("flow") || "",
                      latency: 0,
                      active: idx === 0,
                    };
                  } catch {
                    return null;
                  }
                }
                return null;
              })
              .filter(Boolean) as VlessNode[];
          } else if (res.nodes && Array.isArray(res.nodes)) {
            newNodes = res.nodes;
          } else {
            newNodes = [];
          }

          // Helper to decode base64 strings if prefixed with base64:
          const decodeB64Safe = (val?: string) => {
            if (!val || typeof val !== "string") return val;
            if (val.startsWith("base64:")) {
              try {
                return decodeURIComponent(escape(atob(val.replace(/^base64:/, ""))));
              } catch {
                try {
                  return atob(val.replace(/^base64:/, ""));
                } catch {
                  return val;
                }
              }
            }
            return val;
          };

          const pTitle = decodeB64Safe(res.headers?.profileTitle || res.headers?.["Profile-Title"] || res.profileTitle);
          if (pTitle) {
            meta.profileTitle = pTitle;
          }

          const ann = decodeB64Safe(res.headers?.announce || res.headers?.["Announce"] || res.announce);
          if (ann) {
            meta.announce = ann;
          }

          // Parse userinfo
          const userInfoStr = res.headers?.userInfo || res.headers?.["Subscription-Userinfo"] || "";
          if (userInfoStr) {
            const upMatch = userInfoStr.match(/upload=(\d+)/);
            const downMatch = userInfoStr.match(/download=(\d+)/);
            const totalMatch = userInfoStr.match(/total=(\d+)/);
            const expireMatch = userInfoStr.match(/expire=(\d+)/);
            if (upMatch) meta.uploadBytes = parseInt(upMatch[1], 10);
            if (downMatch) meta.downloadBytes = parseInt(downMatch[1], 10);
            if (totalMatch) meta.totalBytes = parseInt(totalMatch[1], 10);
            if (expireMatch) meta.expireTimestamp = parseInt(expireMatch[1], 10);
          } else if (res.subscription) {
            if (res.subscription.upload) meta.uploadBytes = res.subscription.upload;
            if (res.subscription.download) meta.downloadBytes = res.subscription.download;
            if (res.subscription.total) meta.totalBytes = res.subscription.total;
            if (res.subscription.expire) meta.expireTimestamp = res.subscription.expire;
          }

          meta.lastUpdated = Math.floor(Date.now() / 1000);

          // Check if subscription was rate limited or rejected
          const isKeyUsedOnAnotherDevice = newNodes.some(n => n.server === "0.0.0.0" || n.name.includes("уже используется"));
          if (isKeyUsedOnAnotherDevice && meta.announce) {
            set({
              nodes: newNodes,
              metadata: meta,
              isSyncing: false,
              error: meta.announce,
            });
            return false;
          }

          const activeId = newNodes.length > 0 ? newNodes[0].id : get().activeNodeId;

          set({
            nodes: newNodes,
            metadata: meta,
            activeNodeId: activeId,
            isSyncing: false,
            error: null,
          });

          // Persist to router filesystem so cookie/localStorage deletion preserves the servers
          if (newNodes.length > 0) {
            try {
              await ubusClient.call("circumvention", "sub_save_cache", {
                data: JSON.stringify({
                  nodes: newNodes,
                  metadata: meta,
                  activeNodeId: activeId,
                  timestamp: Math.floor(Date.now() / 1000),
                }),
              });
            } catch (err) {
              console.warn("[SubscriptionStore] Failed to persist subscription to router cache:", err);
            }

          // Persist subscription URL on router so the panel can re-fetch without this browser
          if (url) {
            try {
              await ubusClient.call("circumvention", "sub_set_source", { url, api_key: apiKey });
            } catch (err) {
              console.warn("[SubscriptionStore] Failed to persist subscription source on router:", err);
            }
          }
          }

          // Automatically set outbound on router for active node
          if (newNodes.length > 0) {
            get().setActiveNode(newNodes[0].id).catch(console.error);
          }

          // If auto_best is active, trigger latency test immediately
          if (get().metadata.selectionMode === "auto_best") {
            get().testAllLatencies();
          }

          return true;
        } catch (e: any) {
          const errMsg = e?.message || "Failed to sync subscription";
          if (errMsg.includes("429")) {
            set({ rateLimitUntil: Date.now() + 60000 });
          }
          set({ isSyncing: false, error: errMsg });
          return false;
        }
      },

      setActiveNode: async (nodeId: string) => {
        const { nodes } = get();
        const targetNode = nodes.find((n) => n.id === nodeId);
        if (!targetNode) return false;

        try {
          await ubusClient.singboxSetOutbound({
            id: targetNode.id,
            name: targetNode.name,
            server: targetNode.server,
            port: targetNode.port,
            uuid: targetNode.uuid,
            security: targetNode.security,
            sni: targetNode.sni,
            publicKey: targetNode.publicKey,
            shortId: targetNode.shortId,
            fingerprint: targetNode.fingerprint,
            flow: targetNode.flow,
            transport: targetNode.transport,
          });

          set({
            activeNodeId: nodeId,
            nodes: nodes.map((n) => ({ ...n, active: n.id === nodeId })),
          });
          return true;
        } catch (e: any) {
          set({ error: e?.message || "Failed to switch Sing-box node" });
          return false;
        }
      },

      setSelectionMode: async (mode: "manual" | "auto_best") => {
        set((state) => ({
          metadata: { ...state.metadata, selectionMode: mode },
        }));
        if (mode === "auto_best") {
          await get().testAllLatencies();
        }
      },

      setAutoUpdateInterval: (interval: "disabled" | "6h" | "12h" | "24h") => {
        set((state) => ({
          metadata: { ...state.metadata, autoUpdateInterval: interval },
        }));
      },

      testAllLatencies: async () => {
        const { nodes, metadata } = get();
        set({ isTestingLatency: true });

        const updated = [...nodes];
        for (let i = 0; i < updated.length; i++) {
          try {
            const res = await ubusClient.testNodeLatency(updated[i].server, updated[i].port);
            updated[i] = { ...updated[i], latency: res.latency };
          } catch {
            updated[i] = { ...updated[i], latency: 999 };
          }
        }

        // Sort if in auto_best mode
        if (metadata.selectionMode === "auto_best" && updated.length > 0) {
          const sorted = [...updated].sort((a, b) => (a.latency || 999) - (b.latency || 999));
          const best = sorted[0];
          if (best && best.latency && best.latency < 900) {
            await get().setActiveNode(best.id);
          }
        }

        set({ nodes: updated, isTestingLatency: false });
      },

      deleteNode: (nodeId: string) => {
        const { nodes, activeNodeId } = get();
        const updated = nodes.filter((n) => n.id !== nodeId);
        let nextActive = activeNodeId;
        if (activeNodeId === nodeId) {
          nextActive = updated.length > 0 ? updated[0].id : "";
          if (nextActive) {
            get().setActiveNode(nextActive).catch(console.error);
          }
        }
        set({ nodes: updated, activeNodeId: nextActive });
      },

      deleteSubscription: () => {
        set({
          url: "",
          decryptedUrl: "",
          nodes: [],
          activeNodeId: "",
          metadata: {
            profileTitle: "",
            updateInterval: "12",
            uploadBytes: 0,
            downloadBytes: 0,
            totalBytes: 0,
            expireTimestamp: 0,
            lastUpdated: 0,
            autoUpdateInterval: "disabled",
            selectionMode: "manual",
          },
          error: null,
        });
      },

      createGroup: (group) => {
        const id = `group-${Date.now()}`;
        set((state) => ({
          outboundGroups: [...state.outboundGroups, { ...group, id }],
        }));
      },

      updateGroup: (id, updates) => {
        set((state) => ({
          outboundGroups: state.outboundGroups.map((g) =>
            g.id === id ? { ...g, ...updates } : g
          ),
        }));
      },

      deleteGroup: (id) => {
        set((state) => ({
          outboundGroups: state.outboundGroups.filter((g) => g.id !== id),
        }));
      },

      toggleKillSwitch: async (enabled) => {
        const nextEnabled = enabled !== undefined ? enabled : !get().killSwitch.enabled;
        const currentScope = get().killSwitch.scope;

        try {
          await ubusClient.call("circumvention", "killswitch_set", {
            enabled: nextEnabled,
            scope: currentScope,
            allow_lan: true,
          });
        } catch (err: any) {
          // Router rejected/failed the change: do NOT flip local state, surface the error
          console.error("[SubscriptionStore] Failed to sync kill switch to router:", err);
          set({ error: "Kill switch NOT applied on router: " + (err?.message || String(err)) });
          return false;
        }

        set((state) => ({
          killSwitch: { ...state.killSwitch, enabled: nextEnabled },
          error: null,
        }));
        return true;
      },

      setKillSwitchScope: async (scope) => {
        const wasEnabled = get().killSwitch.enabled;
        if (wasEnabled) {
          try {
            await ubusClient.call("circumvention", "killswitch_set", {
              enabled: true,
              scope,
              allow_lan: true,
            });
          } catch (err: any) {
            console.error("[SubscriptionStore] Failed to update kill switch scope on router:", err);
            set({ error: "Kill-switch scope NOT applied on router: " + (err?.message || String(err)) });
            return;
          }
        }
        set((state) => ({
          killSwitch: { ...state.killSwitch, scope },
          error: null,
        }));
      },

      hydrateFromRouterCache: async () => {
        try {
          const res = await ubusClient.call<any>("circumvention", "sub_get_cache");
          if (res) {
            let data: any = null;
            if (res.nodes && Array.isArray(res.nodes)) {
              data = res;
            } else if (res.data) {
              data = typeof res.data === "string" ? JSON.parse(res.data) : res.data;
            }

            if (data && data.nodes && Array.isArray(data.nodes) && data.nodes.length > 0) {
              set({
                nodes: data.nodes,
                metadata: data.metadata || get().metadata,
                activeNodeId: data.activeNodeId || data.nodes[0].id,
              });
              return true;
            }
          }
        } catch (err) {
          console.warn("[SubscriptionStore] Router cache unavailable:", err);
        }

        // If no cache in router either and nodes array is empty, auto-sync
        if (get().nodes.length === 0 && get().url) {
          return await get().syncSubscription();
        }
        return false;
      },
    }),
    {
      name: "happ-subscription-storage",
      partialize: (state) => ({
        url: state.url,
        apiKey: state.apiKey,
        metadata: state.metadata,
        activeNodeId: state.activeNodeId,
        nodes: state.nodes,
        outboundGroups: state.outboundGroups,
        killSwitch: state.killSwitch,
      }),
    }
  )
);