import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ubusClient } from "@/lib/ubus-client";
import { useI18nStore } from "@/store/i18n-store";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, RefreshCw, Copy, Download } from "lucide-react";

export const SystemLogs: React.FC = () => {
  const { t, lang } = useI18nStore();
  const [filter, setFilter] = useState("");
  const [logType, setLogType] = useState<"system" | "dmesg">("system");

  const { data, refetch, isFetching, isError, error } = useQuery({
    queryKey: ["system-log", logType],
    queryFn: async () => {
      if (logType === "dmesg") {
        const execRes = await ubusClient.exec("dmesg", []);
        const out = (execRes.stdout || "").trim();
        if (!out) throw new Error(execRes.stderr || "dmesg returned no output");
        return out.split("\n");
      }
      const res = await ubusClient.getLog(150);
      return res.log || [];
    },
    refetchInterval: 5000,
    retry: 1,
  });

  const lines = data || [];
  const filtered = lines.filter((line) => line.toLowerCase().includes(filter.toLowerCase()));

  const handleCopy = () => {
    navigator.clipboard.writeText(filtered.join("\n"));
    alert(lang === "ru" ? "Логи скопированы в буфер" : "Copied logs to clipboard");
  };

  const handleDownload = () => {
    const blob = new Blob([filtered.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `openwrt_${logType}_${Date.now()}.log`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-foreground">{t.logs.title}</h2>
          <p className="text-xs text-muted-foreground">{t.logs.subtitle}</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={logType === "system" ? "default" : "outline"}
            size="sm"
            onClick={() => setLogType("system")}
            className="text-xs h-8"
          >
            {t.logs.systemLog}
          </Button>
          <Button
            variant={logType === "dmesg" ? "default" : "outline"}
            size="sm"
            onClick={() => setLogType("dmesg")}
            className="text-xs h-8"
          >
            {t.logs.kernelLog}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-8 w-8"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b">
          <div className="flex items-center gap-2 w-full sm:w-80">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={t.logs.searchPlaceholder}
              className="h-8 text-xs bg-background/50"
            />
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs font-mono">
              {filtered.length} {t.logs.lines}
            </Badge>
            <Button variant="outline" size="sm" onClick={handleCopy} className="h-8 text-xs gap-1.5">
              <Copy className="h-3 w-3" />
              {t.common.copy}
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownload} className="h-8 text-xs gap-1.5">
              <Download className="h-3 w-3" />
              {t.common.export}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="h-[480px] w-full overflow-y-auto bg-black/60 font-mono text-[11px] p-4 text-emerald-400 space-y-1">
            {isError ? (
              <div className="text-red-400 text-center py-12 space-y-1">
                <div>{lang === "ru" ? "Не удалось прочитать журнал роутера" : "Could not read router logs"}</div>
                <div className="text-[10px] text-muted-foreground break-all">{String((error as any)?.message || error)}</div>
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-muted-foreground text-center py-12">{t.logs.noLogs}</div>
            ) : (
              filtered.map((line, idx) => {
                const isErr = line.includes("err") || line.includes("fail") || line.includes("warn");
                return (
                  <div
                    key={idx}
                    className={`leading-relaxed break-all ${isErr ? "text-amber-400 font-semibold" : "text-emerald-300/90"}`}
                  >
                    <span className="text-muted-foreground mr-2 select-none">[{idx + 1}]</span>
                    {line}
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
