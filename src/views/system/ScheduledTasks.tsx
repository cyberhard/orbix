import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Save, Loader2, CheckCircle2, RotateCcw, Sparkles } from "lucide-react";
import { ubusClient } from "@/lib/ubus-client";
import { useI18nStore } from "@/store/i18n-store";

const SNIPPETS = [
  { label: "Обновление Podkop (в 04:00)", cron: "0 4 * * * /usr/bin/podkop update >/dev/null 2>&1" },
  { label: "Рестарт Zapret (понедельник 04:30)", cron: "30 4 * * 1 /etc/init.d/zapret restart >/dev/null 2>&1" },
  { label: "Синхронизация времени NTP (каждые 6 часов)", cron: "0 */6 * * * /usr/sbin/ntpd -q -p time.cloudflare.com >/dev/null 2>&1" },
];

export const ScheduledTasks: React.FC = () => {
  const [crontab, setCrontab] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const { lang } = useI18nStore();

  const loadCrontab = async () => {
    try {
      setLoading(true);
      const content = await ubusClient.readFile("/etc/crontabs/root");
      setCrontab(content || "# OpenWrt crontab for root\n# minute hour day-of-month month day-of-week command\n");
    } catch (err: any) {
      console.error("Failed to read crontab:", err);
      setMessage({ text: `Failed to load crontab: ${err.message}`, error: true });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCrontab();
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage(null);
      await ubusClient.writeFile("/etc/crontabs/root", crontab);
      // Restart cron daemon to reload updated crontabs
      try {
        await ubusClient.initService("cron", "restart");
      } catch {}

      setMessage({
        text: lang === "ru"
          ? "Расписание cron успешно сохранено и применено демоном crond!"
          : "Crontab successfully saved to /etc/crontabs/root and crond restarted!",
      });
    } catch (err: any) {
      setMessage({ text: `Error saving crontab: ${err.message}`, error: true });
    } finally {
      setSaving(false);
    }
  };

  const insertSnippet = (snippet: string) => {
    setCrontab((prev) => {
      const trimmed = prev.trim();
      return trimmed ? `${trimmed}\n${snippet}\n` : `${snippet}\n`;
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-foreground">
            {lang === "ru" ? "Планировщик задач (Crontab)" : "Scheduled Tasks (Crontab)"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {lang === "ru"
              ? "Автоматизация фонового обслуживания, обновления списков и перезапуска служб"
              : "Automate background maintenance, list updates, and scheduled service restarts"}
          </p>
        </div>

        <Button
          variant="default"
          size="sm"
          onClick={handleSave}
          disabled={saving || loading}
          className="text-xs gap-1.5 h-8 bg-emerald-600 hover:bg-emerald-500"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          <span>{lang === "ru" ? "Сохранить Crontab" : "Save Crontab"}</span>
        </Button>
      </div>

      {message && (
        <div
          className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
            message.error
              ? "bg-destructive/10 border-destructive/30 text-destructive"
              : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-xs opacity-70 hover:opacity-100">
            ✕
          </button>
        </div>
      )}

      {/* Quick Snippets */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Sparkles className="h-3.5 w-3.5 text-amber-400" />
          {lang === "ru" ? "Вставить готовый шаблон:" : "Quick Templates:"}
        </span>
        {SNIPPETS.map((s, idx) => (
          <button
            key={idx}
            onClick={() => insertSnippet(s.cron)}
            className="text-xs px-2.5 py-1 rounded-md border border-zinc-800 bg-zinc-900/70 hover:bg-zinc-800 hover:text-zinc-100 text-zinc-300 transition-colors"
          >
            + {s.label}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            <span>Crontab Editor (/etc/crontabs/root)</span>
          </CardTitle>
          <Badge variant="outline" className="text-[10px] font-mono text-zinc-400">
            crond (PID active)
          </Badge>
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          {loading ? (
            <div className="h-56 flex items-center justify-center text-xs text-muted-foreground gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span>{lang === "ru" ? "Чтение /etc/crontabs/root..." : "Reading crontab..."}</span>
            </div>
          ) : (
            <textarea
              value={crontab}
              onChange={(e) => setCrontab(e.target.value)}
              className="w-full h-64 p-3 rounded-lg border border-zinc-800 bg-black/80 font-mono text-xs text-emerald-400 focus:outline-none focus:ring-1 focus:ring-primary selection:bg-emerald-900"
              placeholder="# min hour day month weekday command"
            />
          )}
          <div className="text-[11px] text-muted-foreground font-mono">
            {lang === "ru" ? "Формат: " : "Format: "}
            <code className="text-zinc-300">minute (0-59) hour (0-23) day (1-31) month (1-12) weekday (0-6) command</code>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
