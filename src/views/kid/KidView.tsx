import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ubusClient } from "@/lib/ubus-client";
import type { KidDevice, KidStatusResponse } from "@/types/ubus";
import { useI18nStore } from "@/store/i18n-store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Monitor,
  Smartphone,
  Tv,
  Laptop,
  Wifi,
  WifiOff,
  Moon,
  Maximize2,
  Minimize2,
  Settings2,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Categories shown as big tiles. IDs must match /usr/lib/panel-kid/blocks/<id>.txt on router.
const CATEGORIES: Array<{ id: string; emoji: string; ru: string; en: string }> = [
  { id: "youtube", emoji: "📺", ru: "YouTube", en: "YouTube" },
  { id: "games", emoji: "🎮", ru: "Игры", en: "Games" },
  { id: "social", emoji: "💬", ru: "Соцсети", en: "Social" },
  { id: "adult", emoji: "🔞", ru: "Взрослое", en: "Adult" },
];

const deviceIcon = (name: string) => {
  const h = name.toLowerCase();
  if (/(tv|пристав|xiaomi|sber|яндекс|stanza|colon)/.test(h)) return Tv;
  if (/(phone|redmi|tecno|poco|iphone|note|galaxy|pixel|smart|honor|realme|oneplus|mate)/.test(h)) return Smartphone;
  if (/(laptop|book|pc|комп|think|asus|acer|dell|mac)/.test(h)) return Laptop;
  return Monitor;
};

export const KidView: React.FC = () => {
  const { lang } = useI18nStore();
  const ru = lang === "ru";
  const qc = useQueryClient();
  const [big, setBig] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["kid-status"],
    queryFn: () => ubusClient.getKidStatus(),
    refetchInterval: 5000,
  });

  const apply = (next: KidStatusResponse | undefined) => {
    if (next && next.status === "ok") {
      qc.setQueryData(["kid-status"], next);
      setError(null);
    } else if (next && next.message) {
      setError(next.message);
    }
  };

  const run = async (id: string, fn: () => Promise<KidStatusResponse>) => {
    setBusy(id);
    setError(null);
    try {
      apply(await fn());
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setBusy(null);
    }
  };

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        {ru ? "Смотрим, что дома…" : "Checking the house…"}
      </div>
    );
  }

  const internetOn = data.effective;
  const blockedByBedtime = data.auto_bedtime && data.master && !data.effective;
  const blockedByIdle = !data.master;

  const toggleInternet = () =>
    run("master", () => ubusClient.kidSetMaster(data.master ? false : true));

  const toggleBlock = (cat: string) =>
    run(`block-${cat}`, () => ubusClient.kidSetBlock(cat, !data.blocks.includes(cat)));

  const toggleDevice = (d: KidDevice) =>
    run(`dev-${d.mac}`, () =>
      ubusClient.kidSetDevice(d.mac, d.paused, d.name === "*" ? "" : d.name)
    );

  const setBedtime = (on: boolean, start: string, end: string) =>
    run("bedtime", () => ubusClient.kidSetBedtime(on, start, end));

  // ---------- shared body (rendered normal or full-screen) ----------
  const body = (
    <div className={cn("space-y-6", big && "mx-auto max-w-6xl px-4 py-6")}>
      {/* Internet master */}
      <Card className={cn("border-2", internetOn ? "border-emerald-500/40" : "border-red-500/50")}>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="text-center sm:text-left">
              <div className="text-2xl font-bold">{ru ? "Интернет в доме" : "Home internet"}</div>
              <div className="text-sm text-muted-foreground mt-1">
                {internetOn
                  ? ru ? "Работает везде" : "Working everywhere"
                  : blockedByBedtime
                    ? ru ? `Сейчас отдых (сон ${data.bedtime_start}–${data.bedtime_end})` : `Sleep time (${data.bedtime_start}–${data.bedtime_end})`
                    : ru ? "Выключен большой кнопкой" : "Turned off with the big button"}
              </div>
            </div>
            <button
              onClick={toggleInternet}
              disabled={busy === "master"}
              className={cn(
                "h-36 w-36 rounded-full border-4 flex flex-col items-center justify-center gap-1 transition-all active:scale-95 disabled:opacity-50 select-none",
                internetOn
                  ? "bg-emerald-500/15 border-emerald-500 text-emerald-400 hover:bg-emerald-500/25"
                  : "bg-red-500/15 border-red-500 text-red-400 hover:bg-red-500/25"
              )}
            >
              {internetOn ? <Wifi className="h-14 w-14" /> : <WifiOff className="h-14 w-14" />}
              <span className="text-lg font-bold">
                {internetOn ? (ru ? "ВКЛ" : "ON") : ru ? "выкл" : "off"}
              </span>
            </button>
          </div>
          {blockedByIdle && (
            <p className="text-xs text-amber-500/90 mt-4 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {ru
                ? "Когда интернет выключен — он выключен у всех, и у взрослых тоже. Эта страница при этом работает."
                : "When internet is off, it is off for everyone, adults too. This page keeps working."}
            </p>
          )}
          {blockedByBedtime && (
            <p className="text-xs text-muted-foreground mt-4">
              {ru
                ? "Это время сна. Чтобы вернуть интернет прямо сейчас — выключи «Время сна» ниже или нажми большую кнопку."
                : "It is sleep time. To bring internet back now — turn off «Sleep time» below or press the big button."}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Categories */}
      <div>
        <h3 className="text-lg font-bold mb-1">{ru ? "Что запрещено?" : "What is blocked?"}</h3>
        <p className="text-xs text-muted-foreground mb-3">
          {ru
            ? "Нажми на плитку, чтобы запретить или разрешить. Работает для всех устройств сразу."
            : "Tap a tile to block or allow. Works for every device at once."}
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {CATEGORIES.map((c) => {
            const blocked = data.blocks.includes(c.id);
            return (
              <button
                key={c.id}
                onClick={() => toggleBlock(c.id)}
                disabled={busy === `block-${c.id}`}
                className={cn(
                  "rounded-2xl border-2 p-5 flex flex-col items-center gap-2 transition-all active:scale-95 disabled:opacity-50 select-none",
                  blocked
                    ? "border-red-500/60 bg-red-500/10 text-red-300"
                    : "border-emerald-500/40 bg-emerald-500/5 text-emerald-300"
                )}
              >
                <span className="text-5xl">{c.emoji}</span>
                <span className="text-lg font-bold text-foreground">{ru ? c.ru : c.en}</span>
                <span className="text-sm font-semibold">
                  {blocked ? (ru ? "ЗАПРЕЩЕНО" : "BLOCKED") : ru ? "можно" : "allowed"}
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">
          {ru
            ? "Запрет работает через DNS роутера. Любознательный ребёнок, который вручную пропишет чужой DNS в настройках сети, запрет обойдёт — это предел таких блокировок, а не поломка."
            : "Blocking works through the router DNS. A curious kid who sets a foreign DNS manually on a device will bypass it — that is the limit of DNS blocking, not a bug."}
        </p>
      </div>

      {/* Sleep time */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Moon className="h-5 w-5 text-indigo-400" />
            {ru ? "Время сна" : "Sleep time"}
          </CardTitle>
          <CardDescription className="text-xs">
            {ru
              ? "Каждый день в это время интернет дома выключается сам, утром включается."
              : "Every day at this time home internet switches itself off, and back on in the morning."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BedtimeRow
            ru={ru}
            enabled={data.auto_bedtime}
            start={data.bedtime_start || "21:30"}
            end={data.bedtime_end || "07:00"}
            busy={busy === "bedtime"}
            onSave={setBedtime}
          />
        </CardContent>
      </Card>

      {/* Devices */}
      <div>
        <h3 className="text-lg font-bold mb-1">{ru ? "Устройства" : "Devices"}</h3>
        <p className="text-xs text-muted-foreground mb-3">
          {ru
            ? "Красная кнопка — выключить интернет этому устройству. Роутер узнаёт устройства по DHCP."
            : "Red button turns off internet for that device. The router learns devices from DHCP."}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {data.devices
            .slice()
            .sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name))
            .map((d) => {
              const Icon = deviceIcon(d.name || d.ip);
              const label = !d.name || d.name === "*" ? (ru ? "Без имени" : "Unnamed") : d.name;
              return (
                <div
                  key={d.mac}
                  className={cn(
                    "rounded-xl border p-4 flex items-center gap-3",
                    d.paused ? "border-red-500/40 bg-red-500/5" : "border-border bg-card"
                  )}
                >
                  <Icon className={cn("h-7 w-7 shrink-0", d.online ? "text-emerald-400" : "text-zinc-600")} />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold truncate">{label}</div>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
                      {d.ip}
                      {d.online ? (
                        <Badge variant="outline" className="text-emerald-400 border-emerald-500/40 px-1 py-0 text-[9px]">
                          {ru ? "в сети" : "online"}
                        </Badge>
                      ) : (
                        <span className="text-zinc-600">{ru ? "не в сети" : "offline"}</span>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={d.paused ? "outline" : "destructive"}
                    disabled={busy === `dev-${d.mac}`}
                    onClick={() => toggleDevice(d)}
                    className="shrink-0 min-w-[104px]"
                  >
                    {d.paused ? (ru ? "Включить" : "Allow") : ru ? "Выключить" : "Block"}
                  </Button>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold">{ru ? "Пульт для детей" : "Kids remote"}</h2>
          <p className="text-xs text-muted-foreground">
            {ru
              ? "Всё по-настоящему: эти кнопки правила на роутере и меняют, и снимают."
              : "Everything is real: these buttons write and remove actual router rules."}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setBig(!big)}>
          {big ? <Minimize2 className="h-4 w-4 mr-1.5" /> : <Maximize2 className="h-4 w-4 mr-1.5" />}
          {big ? (ru ? "Обычный экран" : "Normal screen") : ru ? "Экран для ребёнка" : "Kid screen"}
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 text-red-300 text-sm px-3 py-2 flex items-center justify-between">
          <span className="break-all">{ru ? "Роутер ответил ошибкой: " : "Router error: "}{error}</span>
          <button onClick={() => setError(null)} className="ml-3 opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      {big ? (
        <div className="fixed inset-0 z-[100] bg-background overflow-y-auto">
          <div className="flex justify-end p-2">
            <button
              onClick={() => setBig(false)}
              className="flex items-center gap-1 text-[11px] text-muted-foreground/60 hover:text-foreground px-2 py-1 rounded"
              title={ru ? "Режим взрослых" : "Adult mode"}
            >
              <Settings2 className="h-3.5 w-3.5" />
              {ru ? "режим взрослых" : "adult mode"}
            </button>
          </div>
          {body}
          <div className="h-16" />
        </div>
      ) : (
        body
      )}
    </div>
  );
};

const BedtimeRow: React.FC<{
  ru: boolean;
  enabled: boolean;
  start: string;
  end: string;
  busy: boolean;
  onSave: (on: boolean, start: string, end: string) => void;
}> = ({ ru, enabled, start, end, busy, onSave }) => {
  const [on, setOn] = useState(enabled);
  const [s, setS] = useState(start);
  const [e, setE] = useState(end);
  // resync when server data changes and we are untouched-looking
  React.useEffect(() => {
    setOn(enabled);
    setS(start);
    setE(end);
  }, [enabled, start, end]);

  const dirty = on !== enabled || s !== start || e !== end;
  const valid = /^([01]\d|2[0-3]):[0-5]\d$/.test(s) && /^([01]\d|2[0-3]):[0-5]\d$/.test(e);

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex items-center gap-2">
        <Switch checked={on} onCheckedChange={setOn} disabled={busy} id="kid-bedtime-sw" />
        <label htmlFor="kid-bedtime-sw" className="text-sm cursor-pointer">
          {ru ? "Каждый день" : "Every day"}
        </label>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">{ru ? "с" : "from"}</span>
        <Input type="time" value={s} onChange={(ev) => setS(ev.target.value)} className="w-32 h-9 text-sm" disabled={busy} />
        <span className="text-xs text-muted-foreground">{ru ? "до" : "until"}</span>
        <Input type="time" value={e} onChange={(ev) => setE(ev.target.value)} className="w-32 h-9 text-sm" disabled={busy} />
      </div>
      <Button size="sm" disabled={!dirty || !valid || busy} onClick={() => onSave(on, s, e)}>
        {busy && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
        {ru ? "Сохранить" : "Save"}
      </Button>
      {!valid && <span className="text-xs text-red-400">{ru ? "время в формате ЧЧ:ММ" : "format HH:MM"}</span>}
      {dirty && valid && !busy && (
        <span className="text-xs text-amber-400">{ru ? "не сохранено" : "unsaved"}</span>
      )}
    </div>
  );
};
