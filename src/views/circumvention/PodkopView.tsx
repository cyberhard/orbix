import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ubusClient } from "@/lib/ubus-client";
import { useI18nStore } from "@/store/i18n-store";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Layers,
  RefreshCw,
  Plus,
  Trash2,
  Video,
  MessageSquare,
  Bot,
  Share2,
  Globe2,
} from "lucide-react";
import { PodkopConfig } from "@/types/ubus";

export const PodkopView: React.FC = () => {
  const { t, lang } = useI18nStore();
  const { data: configData } = useQuery({
    queryKey: ["podkop-config"],
    queryFn: () => ubusClient.getPodkopConfig(),
  });

  const [config, setConfig] = useState<PodkopConfig>(configData || {
    enabled: true,
    mode: "mixed",
    outbound_interface: "singbox",
    services: {
      youtube: true,
      discord: true,
      meta: true,
      ai_services: true,
      telegram: false,
      notion: true,
    },
    custom_domains: ["medium.com", "github.com", "rutracker.org"],
    custom_subnets: ["140.82.112.0/20"],
  });

  const [newDomain, setNewDomain] = useState("");
  const [newSubnet, setNewSubnet] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveRules = async () => {
    setIsSaving(true);
    try {
      await ubusClient.setUci("podkop", "main", {
        enabled: config.enabled ? "1" : "0",
        mode: config.mode,
        outbound_interface: config.outbound_interface,
      });
      await ubusClient.commitUci("podkop");
      const res = await ubusClient.podkopUpdate();
      if (res.status === "ok") {
        alert(
          lang === "ru"
            ? "Основные настройки Podkop сохранены в UCI и служба перезапущена.\nСписки сервисов и пользовательские адреса НЕ записаны — панель не знает их UCI-схему (раздел черновика)."
            : "Core Podkop settings saved to UCI and the service reloaded.\nService toggles and custom addresses were NOT written — the panel does not know their UCI schema (draft section)."
        );
      } else {
        alert(lang === "ru" ? `СОХРАНЕНО, НО ПЕРЕЗАПУСК УПАЛ: ${res.message}` : `SAVED, BUT RELOAD FAILED: ${res.message}`);
      }
    } catch (e: any) {
      alert(lang === "ru" ? `ОШИБКА СОХРАНЕНИЯ: ${e?.message || String(e)}` : `SAVE ERROR: ${e?.message || String(e)}`);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleService = (svc: keyof typeof config.services) => {
    setConfig((prev) => ({
      ...prev,
      services: {
        ...prev.services,
        [svc]: !prev.services[svc],
      },
    }));
  };

  const handleAddDomain = () => {
    if (!newDomain.trim()) return;
    const d = newDomain.trim().toLowerCase();
    if (!config.custom_domains.includes(d)) {
      setConfig((prev) => ({ ...prev, custom_domains: [...prev.custom_domains, d] }));
    }
    setNewDomain("");
  };

  const handleRemoveDomain = (d: string) => {
    setConfig((prev) => ({
      ...prev,
      custom_domains: prev.custom_domains.filter((item) => item !== d),
    }));
  };

  const handleAddSubnet = () => {
    if (!newSubnet.trim()) return;
    const s = newSubnet.trim();
    if (!config.custom_subnets.includes(s)) {
      setConfig((prev) => ({ ...prev, custom_subnets: [...prev.custom_subnets, s] }));
    }
    setNewSubnet("");
  };

  const handleRemoveSubnet = (s: string) => {
    setConfig((prev) => ({
      ...prev,
      custom_subnets: prev.custom_subnets.filter((item) => item !== s),
    }));
  };

  const handleUpdateLists = async () => {
    setIsUpdating(true);
    try {
      const res = await ubusClient.podkopUpdate();
      if (res.status === "ok") {
        alert(
          lang === "ru"
            ? "Podkop перезапущен на роутере.\n" + (res.output || "(нет вывода)")
            : "Podkop reloaded on the router.\n" + (res.output || "(no output)")
        );
      } else {
        alert(lang === "ru" ? `ОШИБКА: ${res.message || "podkop reload failed"}` : `ERROR: ${res.message || "podkop reload failed"}`);
      }
    } catch (e: any) {
      alert(lang === "ru" ? `ОШИБКА: ${e?.message || String(e)}` : `ERROR: ${e?.message || String(e)}`);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-foreground">{t.podkop.title}</h2>
          <p className="text-xs text-muted-foreground">{t.podkop.subtitle}</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleUpdateLists}
            disabled={isUpdating}
            className="text-xs gap-1.5 h-8"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isUpdating ? "animate-spin" : ""}`} />
            {isUpdating ? t.podkop.syncing : t.podkop.updateFeeds}
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleSaveRules}
            disabled={isSaving}
            className="text-xs bg-emerald-600 hover:bg-emerald-500 h-8"
          >
            {isSaving ? (lang === "ru" ? "Сохранение..." : "Saving...") : t.podkop.saveRules}
          </Button>
        </div>
      </div>

      {/* Honest scope banner: only core settings have a verified write path */}
      <div className="p-3 rounded-lg border border-amber-800/50 bg-amber-950/20 text-amber-300/90 text-[11px]">
        {lang === "ru"
          ? "«Сохранить» записывает в UCI только режим, интерфейс выхода и включение Podkop. Переключатели сервисов и пользовательские домены/подсети — черновик: их схема UCI панелью не проверялась и на роутер не попадает."
          : "\"Save\" writes only mode, outbound interface and the enable flag to UCI. Service toggles and custom domains/subnets are a draft: their UCI schema was never verified, so they never reach the router."}
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left Column: Operating Mode & Outbound */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" />
                  <span>{t.podkop.podkopStatus}</span>
                </CardTitle>
                <Badge variant={config.enabled ? "success" : "secondary"}>
                  {config.enabled ? t.common.running : t.common.disabled}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-foreground">{t.podkop.enableService}</span>
                <Switch
                  checked={config.enabled}
                  onCheckedChange={(enabled) => setConfig((prev) => ({ ...prev, enabled }))}
                />
              </div>

              <div className="space-y-2 pt-2 border-t border-border/40">
                <label className="text-xs font-semibold text-foreground">{t.podkop.operatingMode}</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["mixed", "sing-box", "byedpi", "awg"] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setConfig((prev) => ({ ...prev, mode }))}
                      className={`p-2 rounded-lg border text-xs font-mono uppercase text-center transition-all ${
                        config.mode === mode
                          ? "border-primary bg-primary/10 text-primary font-bold"
                          : "border-border bg-card/40 text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-border/40">
                <label className="text-xs font-semibold text-foreground">{t.podkop.outboundIface}</label>
                <div className="space-y-1">
                  {[
                    { id: "singbox", label: "Sing-box (VLESS Reality)", tag: "TProxy :10808" },
                    { id: "awg0", label: "AmneziaWG (awg0)", tag: "WireGuard" },
                    { id: "wan", label: lang === "ru" ? "Прямой WAN" : "Direct WAN", tag: "Unencrypted" },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setConfig((prev) => ({ ...prev, outbound_interface: opt.id }))}
                      className={`w-full flex items-center justify-between p-2.5 rounded-lg border text-left text-xs transition-all ${
                        config.outbound_interface === opt.id
                          ? "border-emerald-500 bg-emerald-500/10 text-foreground font-medium"
                          : "border-border/60 bg-card/40 text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      <span>{opt.label}</span>
                      <span className="font-mono text-[10px] text-muted-foreground">{opt.tag}</span>
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Center / Right: Curated Service Categories */}
        <div className="md:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-semibold">{t.podkop.curatedCats}</CardTitle>
              <CardDescription>
                {t.podkop.curatedDesc}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { id: "youtube", label: "YouTube & Googlevideo", desc: "Video CDN, ytimg, gvt1, googlevideo", icon: <Video className="h-4 w-4 text-red-500" /> },
                  { id: "discord", label: "Discord & Voice WebRTC", desc: "Gateway, voice media, avatars, cdn", icon: <MessageSquare className="h-4 w-4 text-indigo-400" /> },
                  { id: "ai_services", label: "AI Services & LLMs", desc: "OpenAI, ChatGPT, Claude, Perplexity", icon: <Bot className="h-4 w-4 text-emerald-400" /> },
                  { id: "meta", label: "Meta Platforms", desc: "Instagram, Facebook, Threads, WhatsApp", icon: <Share2 className="h-4 w-4 text-blue-400" /> },
                  { id: "notion", label: "Notion & Productivity", desc: "notion.so, notion.site, workspace", icon: <Globe2 className="h-4 w-4 text-amber-400" /> },
                  { id: "telegram", label: "Telegram Web & API", desc: "web.telegram.org, t.me, cdn IP subnets", icon: <MessageSquare className="h-4 w-4 text-sky-400" /> },
                ].map((svc) => {
                  const key = svc.id as keyof typeof config.services;
                  const isChecked = config.services[key];

                  return (
                    <div
                      key={svc.id}
                      className={`flex items-start justify-between p-3 rounded-lg border transition-all ${
                        isChecked ? "border-primary/40 bg-primary/5" : "border-border/60 bg-card/40"
                      }`}
                    >
                      <div className="flex gap-2.5">
                        <div className="mt-0.5">{svc.icon}</div>
                        <div>
                          <div className="text-xs font-semibold text-foreground">{svc.label}</div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">{svc.desc}</div>
                        </div>
                      </div>
                      <Switch checked={isChecked} onCheckedChange={() => toggleService(key)} />
                    </div>
                  );
                })}
              </div>

              {/* Custom Domains & Subnets */}
              <div className="pt-4 border-t border-border/40 grid gap-4 sm:grid-cols-2">
                {/* Custom Domains */}
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-foreground">{t.podkop.customBypassDomains}</span>
                  <div className="flex gap-2">
                    <Input
                      value={newDomain}
                      onChange={(e) => setNewDomain(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddDomain()}
                      placeholder={lang === "ru" ? "Добавить домен (например, rutracker.org)" : "Add domain (e.g. rutracker.org)"}
                      className="font-mono text-xs h-8"
                    />
                    <Button variant="outline" size="sm" onClick={handleAddDomain} className="h-8 text-xs">
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {config.custom_domains.map((d) => (
                      <div
                        key={d}
                        className="flex items-center justify-between p-1.5 px-2.5 rounded bg-background/50 border border-border/40 text-xs font-mono"
                      >
                        <span>{d}</span>
                        <button
                          onClick={() => handleRemoveDomain(d)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Custom Subnets */}
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-foreground">{t.podkop.customCidrSubnets}</span>
                  <div className="flex gap-2">
                    <Input
                      value={newSubnet}
                      onChange={(e) => setNewSubnet(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddSubnet()}
                      placeholder={lang === "ru" ? "Добавить CIDR (например, 1.2.3.0/24)" : "Add CIDR (e.g. 1.2.3.0/24)"}
                      className="font-mono text-xs h-8"
                    />
                    <Button variant="outline" size="sm" onClick={handleAddSubnet} className="h-8 text-xs">
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {config.custom_subnets.map((s) => (
                      <div
                        key={s}
                        className="flex items-center justify-between p-1.5 px-2.5 rounded bg-background/50 border border-border/40 text-xs font-mono"
                      >
                        <span>{s}</span>
                        <button
                          onClick={() => handleRemoveSubnet(s)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
