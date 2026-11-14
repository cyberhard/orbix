import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Terminal, Play, Loader2, Sparkles, AlertCircle } from "lucide-react";
import { ubusClient } from "@/lib/ubus-client";
import { useI18nStore } from "@/store/i18n-store";

const PRESETS = [
  { label: "1.1.1.1 (Cloudflare)", host: "1.1.1.1" },
  { label: "77.88.8.8 (Yandex RuNet)", host: "77.88.8.8" },
  { label: "google.com (Global WAN)", host: "google.com" },
  { label: "googlevideo.com (YouTube)", host: "googlevideo.com" },
  { label: "discord.com (Voice/DPI)", host: "discord.com" },
  { label: "dns-ai.ru (Smart DNS)", host: "dns-ai.ru" },
];

export const Diagnostics: React.FC = () => {
  const [target, setTarget] = useState("1.1.1.1");
  const [tool, setTool] = useState<"ping" | "traceroute" | "nslookup">("ping");
  const [output, setOutput] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [exitCode, setExitCode] = useState<number | null>(null);
  const { lang } = useI18nStore();

  const handleRun = async (overrideTarget?: string) => {
    const hostToTest = (overrideTarget || target).trim();
    if (!hostToTest) return;

    // Sanitize target against shell characters
    const cleanHost = hostToTest.replace(/[^a-zA-Z0-9.-]/g, "");
    if (!cleanHost) {
      setOutput("Error: Invalid hostname or IP address format.");
      return;
    }

    setIsRunning(true);
    setOutput(null);
    setExitCode(null);

    try {
      let cmd = "ping";
      let params: string[] = [];

      if (tool === "ping") {
        cmd = "ping";
        params = ["-c", "4", "-W", "2", cleanHost];
      } else if (tool === "traceroute") {
        cmd = "traceroute";
        params = ["-q", "1", "-w", "2", "-m", "15", cleanHost];
      } else {
        cmd = "nslookup";
        params = [cleanHost];
      }

      const res = await ubusClient.exec(cmd, params);
      setExitCode(res.code);

      const combinedOutput = [res.stdout, res.stderr].filter(Boolean).join("\n").trim();
      setOutput(combinedOutput || `(Command finished with exit code ${res.code} and no output)`);
    } catch (err: any) {
      setExitCode(-1);
      setOutput(`Execution error: ${err.message || String(err)}`);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-foreground">
            {lang === "ru" ? "Диагностика сети" : "Network Diagnostics"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {lang === "ru"
              ? "Реальный ICMP Ping, UDP Traceroute и DNS-резолв прямо из ядра роутера"
              : "Live ICMP Ping, UDP Traceroute, and DNS lookup directly from OpenWrt router"}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="text-[10px] font-mono text-zinc-400">
            host: 192.168.1.1
          </Badge>
          {exitCode !== null && (
            <Badge
              variant={exitCode === 0 ? "outline" : "destructive"}
              className="text-[10px] font-mono"
            >
              code: {exitCode}
            </Badge>
          )}
        </div>
      </div>

      {/* Preset pills */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Sparkles className="h-3 w-3 text-amber-400" />
          {lang === "ru" ? "Быстрые цели:" : "Presets:"}
        </span>
        {PRESETS.map((p) => (
          <button
            key={p.host}
            onClick={() => {
              setTarget(p.host);
              handleRun(p.host);
            }}
            className="text-xs px-2.5 py-1 rounded-md border border-zinc-800 bg-zinc-900/70 hover:bg-zinc-800 hover:text-zinc-100 text-zinc-300 transition-colors"
          >
            {p.label}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3 border-b">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button
                variant={tool === "ping" ? "default" : "outline"}
                size="sm"
                onClick={() => setTool("ping")}
                className="text-xs h-8"
              >
                Ping
              </Button>
              <Button
                variant={tool === "traceroute" ? "default" : "outline"}
                size="sm"
                onClick={() => setTool("traceroute")}
                className="text-xs h-8"
              >
                Traceroute
              </Button>
              <Button
                variant={tool === "nslookup" ? "default" : "outline"}
                size="sm"
                onClick={() => setTool("nslookup")}
                className="text-xs h-8"
              >
                Nslookup
              </Button>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Input
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="Target Host / IP..."
                className="h-8 text-xs font-mono w-48 sm:w-64"
                onKeyDown={(e) => e.key === "Enter" && !isRunning && handleRun()}
              />
              <Button
                variant="default"
                size="sm"
                onClick={() => handleRun()}
                disabled={isRunning}
                className="h-8 text-xs gap-1.5"
              >
                {isRunning ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>{lang === "ru" ? "Выполняется..." : "Running..."}</span>
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5" />
                    <span>{lang === "ru" ? "Запустить" : "Run"}</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="h-80 w-full overflow-y-auto bg-black/80 font-mono text-xs p-4 text-emerald-400 whitespace-pre-wrap selection:bg-emerald-800">
            {isRunning ? (
              <div className="flex items-center gap-2 text-zinc-400">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span>
                  {lang === "ru"
                    ? `Выполняется команда ${tool} ${target} на роутере...`
                    : `Executing ${tool} ${target} on router...`}
                </span>
              </div>
            ) : output ? (
              output
            ) : (
              <span className="text-zinc-500">
                {lang === "ru"
                  ? `Введите адрес или выберите цель выше и нажмите "Запустить".`
                  : `Enter an IP address or hostname and press Run to execute ${tool}.`}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
