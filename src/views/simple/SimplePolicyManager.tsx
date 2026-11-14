// Simple Mode Intent-Based Network Policy Manager
import React, { useState } from "react";
import { usePolicyStore } from "@/store/policy-store";
import { useSubscriptionStore } from "@/store/subscription-store";
import { useI18nStore } from "@/store/i18n-store";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Video,
  MessageSquare,
  Globe,
  Building2,
  ShieldAlert,
  Sparkles,
  Lock,
  CheckCircle2,
  Save,
  RefreshCw,
  Zap,
  ArrowRight,
  Shield,
  HelpCircle,
} from "lucide-react";

export const SimplePolicyManager: React.FC = () => {
  const { language } = useI18nStore();
  const isRu = language === "ru";
  const { policies, updatePolicy, applyPoliciesToRouter, isApplying } = usePolicyStore();
  const { killSwitch, toggleKillSwitch } = useSubscriptionStore();

  const [feedback, setFeedback] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3500);
  };

  const getPolicy = (id: string) => policies.find((p) => p.id === id);

  const youtubePolicy = getPolicy("sys-policy-youtube-zapret");
  const discordPolicy = getPolicy("sys-policy-discord-zapret");
  const russiaPolicy = getPolicy("sys-policy-russia-direct");
  const bankingPolicy = getPolicy("sys-policy-banking-direct");
  const aiPolicy = getPolicy("sys-policy-ai-smartdns");
  const geoblockedPolicy = getPolicy("sys-policy-geoblocked-vpn");

  const handleToggle = (id: string, currentEnabled: boolean) => {
    updatePolicy(id, { enabled: !currentEnabled });
    showToast(isRu ? "Политика обновлена! Нажмите 'Применить' для сохранения." : "Policy toggled! Click Apply to persist.");
  };

  const handleApplyAll = async () => {
    const res = await applyPoliciesToRouter();
    if (res.success) {
      showToast(isRu ? "Все правила успешно применены на роутере!" : "All policies applied to router!");
    } else {
      showToast(res.message, "error" as any);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase tracking-wider">
              {isRu ? "Простой режим" : "Simple Mode"}
            </span>
            <h2 className="text-base font-bold text-zinc-100">
              {isRu ? "Управление сетью на понятном языке" : "Human-Friendly Network Steering"}
            </h2>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            {isRu
              ? "Настраивайте правила обхода замедления, туннелей и прямого трафика без погружения в iptables, nftables и UCI."
              : "Steer YouTube, VPN, domestic sites and AI proxies with straightforward questions and visual toggles."}
          </p>
        </div>

        <Button
          size="sm"
          onClick={handleApplyAll}
          disabled={isApplying}
          className="text-xs h-8 bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 font-medium shadow-md shadow-emerald-950/40"
        >
          <Save className={`h-3.5 w-3.5 ${isApplying ? "animate-spin" : ""}`} />
          {isApplying ? (isRu ? "Применение на роутере..." : "Applying...") : (isRu ? "Применить на роутере" : "Apply to Router")}
        </Button>
      </div>

      {feedback && (
        <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-800/40 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Grid of Human-Friendly Scenario Cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Card 1: YouTube DPI Bypass */}
        <Card className="border-zinc-800 bg-zinc-950 hover:border-zinc-700 transition-colors">
          <CardHeader className="pb-3 border-b border-zinc-900">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-950/40 border border-red-800/60 text-red-400">
                  <Video className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-xs font-semibold text-zinc-100">
                    {isRu ? "Обход замедления YouTube (1080p)" : "YouTube DPI Desync (1080p)"}
                  </CardTitle>
                  <CardDescription className="text-[11px] text-zinc-400">
                    {isRu ? "Обход ТСПУ без расхода трафика VPN" : "Fast hostfakesplit bypass without VPN traffic"}
                  </CardDescription>
                </div>
              </div>
              <Switch
                checked={youtubePolicy?.enabled ?? true}
                onCheckedChange={() => handleToggle("sys-policy-youtube-zapret", youtubePolicy?.enabled ?? true)}
                className="data-[state=checked]:bg-red-600 data-[state=unchecked]:bg-zinc-800"
              />
            </div>
          </CardHeader>
          <CardContent className="pt-3 text-xs text-zinc-400 space-y-2">
            <p className="text-[11px]">
              {isRu
                ? "Пакеты googlevideo.com десинхронизируются через Zapret (профиль hostfakesplit). Видео воспроизводится в 1080p60 со скоростью прямого провайдера."
                : "Google Video streams desynchronized via Zapret hostfakesplit. Delivers full 1080p playback at maximum line rate."}
            </p>
            <div className="flex items-center gap-2 pt-1">
              <Badge variant="outline" className="text-[10px] font-mono text-emerald-400 bg-emerald-950/20 border-emerald-800/40">
                Zapret (DPI Desync)
              </Badge>
              <span className="text-[10px] text-zinc-500 font-mono">0 GB VPN spent</span>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Discord */}
        <Card className="border-zinc-800 bg-zinc-950 hover:border-zinc-700 transition-colors">
          <CardHeader className="pb-3 border-b border-zinc-900">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-950/40 border border-purple-800/60 text-purple-400">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-xs font-semibold text-zinc-100">
                    {isRu ? "Разблокировка Discord и голоса" : "Discord Voice & Channels"}
                  </CardTitle>
                  <CardDescription className="text-[11px] text-zinc-400">
                    {isRu ? "Голосовые каналы и вложения discord.media" : "WebRTC voice channels and image attachments"}
                  </CardDescription>
                </div>
              </div>
              <Switch
                checked={discordPolicy?.enabled ?? true}
                onCheckedChange={() => handleToggle("sys-policy-discord-zapret", discordPolicy?.enabled ?? true)}
                className="data-[state=checked]:bg-purple-600 data-[state=unchecked]:bg-zinc-800"
              />
            </div>
          </CardHeader>
          <CardContent className="pt-3 text-xs text-zinc-400 space-y-2">
            <p className="text-[11px]">
              {isRu
                ? "Расщепление TLS-хэндшейка ClientHello на порты 2053, 2083, 8443 для стабильной работы голосовых комнат Discord."
                : "Multisplit ClientHello desync on ports 2053, 2083, 8443 for crystal clear Discord voice chat."}
            </p>
            <div className="flex items-center gap-2 pt-1">
              <Badge variant="outline" className="text-[10px] font-mono text-purple-400 bg-purple-950/20 border-purple-800/40">
                Zapret multisplit
              </Badge>
              <span className="text-[10px] text-zinc-500 font-mono">Voice WebRTC active</span>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Domestic Russian Websites & Banks */}
        <Card className="border-zinc-800 bg-zinc-950 hover:border-zinc-700 transition-colors">
          <CardHeader className="pb-3 border-b border-zinc-900">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-950/40 border border-blue-800/60 text-blue-400">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-xs font-semibold text-zinc-100">
                    {isRu ? "Российские сервисы (.RU) и Банки" : "Russian Services (.RU) & Banks"}
                  </CardTitle>
                  <CardDescription className="text-[11px] text-zinc-400">
                    {isRu ? "Строго напрямую через провайдера без VPN" : "Strictly direct connection without VPN"}
                  </CardDescription>
                </div>
              </div>
              <Switch
                checked={russiaPolicy?.enabled ?? true}
                onCheckedChange={() => handleToggle("sys-policy-russia-direct", russiaPolicy?.enabled ?? true)}
                className="data-[state=checked]:bg-blue-600 data-[state=unchecked]:bg-zinc-800"
              />
            </div>
          </CardHeader>
          <CardContent className="pt-3 text-xs text-zinc-400 space-y-2">
            <p className="text-[11px]">
              {isRu
                ? "Госуслуги, Сбербанк, Т-Банк, ВТБ, Ozon, Wildberries, Кинопоиск, VK и зона .ru всегда работают напрямую с максимальной скоростью и без блокировок банками."
                : "Gosuslugi, Russian banks, Ozon, WB, VK, and all .ru zones strictly bypass VPN to prevent bank account lockouts."}
            </p>
            <div className="flex items-center gap-2 pt-1">
              <Badge variant="outline" className="text-[10px] font-mono text-blue-400 bg-blue-950/20 border-blue-800/40">
                Direct WAN (Bypass)
              </Badge>
              <span className="text-[10px] text-zinc-500 font-mono">Ministry of Digital CA OK</span>
            </div>
          </CardContent>
        </Card>

        {/* Card 4: AI Services (ChatGPT / Claude / Gemini) */}
        <Card className="border-zinc-800 bg-zinc-950 hover:border-zinc-700 transition-colors">
          <CardHeader className="pb-3 border-b border-zinc-900">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-950/40 border border-emerald-800/60 text-emerald-400">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-xs font-semibold text-zinc-100">
                    {isRu ? "ChatGPT, Claude и Gemini (AI)" : "ChatGPT, Claude & Gemini (AI)"}
                  </CardTitle>
                  <CardDescription className="text-[11px] text-zinc-400">
                    {isRu ? "Через Smart DNS (dns-ai.ru) или VLESS туннель" : "Via Smart DNS proxy or VLESS Reality tunnel"}
                  </CardDescription>
                </div>
              </div>
              <Switch
                checked={aiPolicy?.enabled ?? true}
                onCheckedChange={() => handleToggle("sys-policy-ai-smartdns", aiPolicy?.enabled ?? true)}
                className="data-[state=checked]:bg-emerald-600 data-[state=unchecked]:bg-zinc-800"
              />
            </div>
          </CardHeader>
          <CardContent className="pt-3 text-xs text-zinc-400 space-y-2">
            <p className="text-[11px]">
              {isRu
                ? "Открывает доступ к ChatGPT, OpenAI и Claude. Поддерживает прозрачный обратный прокси через dns-ai.ru с задержкой 38 мс."
                : "Unblocks ChatGPT and Claude. Leverages fast transparent reverse proxying or VLESS Reality tunnel."}
            </p>
            <div className="flex items-center gap-2 pt-1">
              <Badge variant="outline" className="text-[10px] font-mono text-emerald-400 bg-emerald-950/20 border-emerald-800/40">
                Smart DNS / VLESS
              </Badge>
              <span className="text-[10px] text-zinc-500 font-mono">38 ms latency</span>
            </div>
          </CardContent>
        </Card>

        {/* Card 5: Geoblocked & Instagram via VLESS */}
        <Card className="border-zinc-800 bg-zinc-950 hover:border-zinc-700 transition-colors">
          <CardHeader className="pb-3 border-b border-zinc-900">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-950/40 border border-purple-800/60 text-purple-400">
                  <Globe className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-xs font-semibold text-zinc-100">
                    {isRu ? "Зарубежные сервисы и Instagram" : "Geoblocked & Instagram (VPN)"}
                  </CardTitle>
                  <CardDescription className="text-[11px] text-zinc-400">
                    {isRu ? "Instagram, Twitter/X, Netflix через VLESS Reality" : "Instagram, Twitter, Netflix via VLESS Reality"}
                  </CardDescription>
                </div>
              </div>
              <Switch
                checked={geoblockedPolicy?.enabled ?? true}
                onCheckedChange={() => handleToggle("sys-policy-geoblocked-vpn", geoblockedPolicy?.enabled ?? true)}
                className="data-[state=checked]:bg-purple-600 data-[state=unchecked]:bg-zinc-800"
              />
            </div>
          </CardHeader>
          <CardContent className="pt-3 text-xs text-zinc-400 space-y-2">
            <p className="text-[11px]">
              {isRu
                ? "Сервисы ушедшие из РФ или заблокированные на уровне BGP провайдера направляются в зарубежный сервер подписки Liberty (Финляндия / Швейцария)."
                : "BGP-dropped subnets and geoblocked sites routed through Liberty Reality outbound (Finland / Switzerland)."}
            </p>
            <div className="flex items-center gap-2 pt-1">
              <Badge variant="outline" className="text-[10px] font-mono text-purple-400 bg-purple-950/20 border-purple-800/40">
                VLESS XTLS Reality
              </Badge>
              <span className="text-[10px] text-zinc-500 font-mono">48 ms RTT</span>
            </div>
          </CardContent>
        </Card>

        {/* Card 6: Kill Switch */}
        <Card className="border-zinc-800 bg-zinc-950 hover:border-zinc-700 transition-colors">
          <CardHeader className="pb-3 border-b border-zinc-900">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-950/40 border border-amber-800/60 text-amber-400">
                  <Lock className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-xs font-semibold text-zinc-100">
                    {isRu ? "Аварийная защита от утечек (Kill Switch)" : "Emergency Kill Switch"}
                  </CardTitle>
                  <CardDescription className="text-[11px] text-zinc-400">
                    {isRu ? "Блокировка трафика при разрыве VPN" : "Blocks unencrypted traffic if tunnel drops"}
                  </CardDescription>
                </div>
              </div>
              <Switch
                checked={killSwitch.enabled}
                onCheckedChange={(val) => {
                  toggleKillSwitch(val);
                  showToast(
                    isRu
                      ? val
                        ? "Kill Switch активирован!"
                        : "Kill Switch отключен"
                      : val
                      ? "Kill Switch enabled!"
                      : "Kill Switch disabled"
                  );
                }}
                className="data-[state=checked]:bg-amber-500 data-[state=unchecked]:bg-zinc-800"
              />
            </div>
          </CardHeader>
          <CardContent className="pt-3 text-xs text-zinc-400 space-y-2">
            <p className="text-[11px]">
              {isRu
                ? "Защищает устройства под VPN от утечки реального IP при обрыве туннеля. Локальная сеть 192.168.1.1 аппаратно защищена от блокировки."
                : "Guarantees no unencrypted traffic leaks to ISP if the tunnel fails. Router management at 192.168.1.1 is strictly preserved."}
            </p>
            <div className="flex items-center gap-2 pt-1">
              <Badge variant="outline" className="text-[10px] font-mono text-amber-400 bg-amber-950/20 border-amber-800/40">
                LAN Admin Protected
              </Badge>
              <span className="text-[10px] text-zinc-500 font-mono">Drop on disconnect</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
