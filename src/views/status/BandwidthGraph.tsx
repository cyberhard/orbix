import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ubusClient } from "@/lib/ubus-client";
import { useI18nStore } from "@/store/i18n-store";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowDownLeft, ArrowUpRight, Activity } from "lucide-react";
import { formatBits, formatBytes } from "@/lib/utils";

interface DataPoint {
  time: string;
  rxSpeed: number; // bps
  txSpeed: number; // bps
}

export const BandwidthGraph: React.FC = () => {
  const { language } = useI18nStore();
  const isRu = language === "ru";
  const [selectedIface, setSelectedIface] = useState("wan");
  const [history, setHistory] = useState<DataPoint[]>([]);
  const lastStatsRef = React.useRef<{ rx: number; tx: number; time: number } | null>(null);

  const { data: ifaces } = useQuery({
    queryKey: ["network-interfaces"],
    queryFn: () => ubusClient.getInterfaces(),
    refetchInterval: 1000,
  });

  const currentIface = ifaces?.find((i) => i.interface === selectedIface) || ifaces?.[0];

  useEffect(() => {
    if (!currentIface?.data?.statistics) return;

    const rx = currentIface.data.statistics.rx_bytes;
    const tx = currentIface.data.statistics.tx_bytes;
    const now = Date.now();

    if (lastStatsRef.current) {
      const dt = Math.max(0.5, (now - lastStatsRef.current.time) / 1000);
      const rxSpeed = Math.max(0, ((rx - lastStatsRef.current.rx) * 8) / dt);
      const txSpeed = Math.max(0, ((tx - lastStatsRef.current.tx) * 8) / dt);

      setHistory((prev) => {
        const next = [
          ...prev.slice(-30),
          {
            time: new Date().toLocaleTimeString().slice(3),
            rxSpeed,
            txSpeed,
          },
        ];
        return next;
      });

      lastStatsRef.current = { rx, tx, time: now };
    } else {
      lastStatsRef.current = { rx, tx, time: now };
    }
  }, [currentIface]);

  const latest = history[history.length - 1] || { rxSpeed: 0, txSpeed: 0 };
  const maxSpeed = Math.max(100000, ...history.map((p) => Math.max(p.rxSpeed, p.txSpeed)));

  return (
    <div className="space-y-6">
      {/* Top interface selection */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-foreground">
            {isRu ? "Трафик интерфейсов в реальном времени" : "Real-time Interface Traffic"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {isRu ? "Высокочастотный мониторинг пропускной способности RX / TX" : "High-frequency RX / TX throughput monitoring"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {ifaces?.map((i) => (
            <Button
              key={i.interface}
              variant={selectedIface === i.interface ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setSelectedIface(i.interface);
                setHistory([]);
                lastStatsRef.current = null;
              }}
              className="text-xs uppercase font-mono h-8"
            >
              {i.interface}
            </Button>
          ))}
        </div>
      </div>

      {/* Speed summary cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground flex items-center justify-between">
              <span>{isRu ? "Входящая скорость (Загрузка / RX)" : "Inbound Rate (Download / RX)"}</span>
              <ArrowDownLeft className="h-4 w-4 text-emerald-400" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-emerald-400">
              {formatBits(latest.rxSpeed)}
            </div>
            <div className="text-[11px] text-muted-foreground font-mono mt-1">
              {isRu ? "Всего получено" : "Total RX"}: {formatBytes(currentIface?.data?.statistics?.rx_bytes || 0)}
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground flex items-center justify-between">
              <span>{isRu ? "Исходящая скорость (Отдача / TX)" : "Outbound Rate (Upload / TX)"}</span>
              <ArrowUpRight className="h-4 w-4 text-blue-400" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-blue-400">
              {formatBits(latest.txSpeed)}
            </div>
            <div className="text-[11px] text-muted-foreground font-mono mt-1">
              {isRu ? "Всего передано" : "Total TX"}: {formatBytes(currentIface?.data?.statistics?.tx_bytes || 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SVG Real-time Chart */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <span>{isRu ? "График пропускной способности" : "Throughput History"} ({selectedIface.toUpperCase()})</span>
          </CardTitle>
          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <span className="text-emerald-400">RX ({isRu ? "Загрузка" : "Download"})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
              <span className="text-blue-400">TX ({isRu ? "Отдача" : "Upload"})</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-64 w-full pt-4">
            <svg className="w-full h-full overflow-visible" viewBox="0 0 600 200">
              {/* Grid lines */}
              {[0, 50, 100, 150].map((y) => (
                <line
                  key={y}
                  x1="0"
                  y1={y}
                  x2="600"
                  y2={y}
                  stroke="currentColor"
                  strokeOpacity="0.1"
                  strokeDasharray="4 4"
                />
              ))}

              {/* RX Path */}
              {history.length > 1 && (
                <>
                  <polyline
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={history
                      .map((p, i) => {
                        const x = (i / Math.max(1, history.length - 1)) * 600;
                        const y = 200 - (p.rxSpeed / maxSpeed) * 180;
                        return `${x},${y}`;
                      })
                      .join(" ")}
                  />
                  {/* TX Path */}
                  <polyline
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={history
                      .map((p, i) => {
                        const x = (i / Math.max(1, history.length - 1)) * 600;
                        const y = 200 - (p.txSpeed / maxSpeed) * 180;
                        return `${x},${y}`;
                      })
                      .join(" ")}
                  />
                </>
              )}
            </svg>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
