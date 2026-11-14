// ORBIX Network Event & Error History View
// Strictly adhering to shadcn/ui Zinc design specifications
import React, { useState, useMemo } from "react";
import { useErrorStore } from "@/store/error-store";
import { useI18nStore } from "@/store/i18n-store";
import { NetworkEvent, ErrorCategory, ErrorSeverity } from "@/types/errors";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Search,
  Download,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Activity,
  Filter,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Shield,
  Clock,
  Layers,
} from "lucide-react";

interface ErrorHistoryViewProps {
  onNavigate?: (route: string) => void;
}

export const ErrorHistoryView: React.FC<ErrorHistoryViewProps> = ({ onNavigate }) => {
  const { lang } = useI18nStore();
  const isRu = lang === "ru";
  const { events, clearHistory, resolveEvent, acknowledgeAll, exportEventsJson } = useErrorStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [selectedEvent, setSelectedEvent] = useState<NetworkEvent | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      // Category filter
      if (categoryFilter !== "all" && e.category !== categoryFilter) return false;
      // Severity filter
      if (severityFilter !== "all" && e.severity !== severityFilter) return false;
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesCode = String(e.code).includes(q);
        const matchesIdent = e.identifier.toLowerCase().includes(q);
        const matchesMsg = e.message.toLowerCase().includes(q);
        const matchesSource = e.source.toLowerCase().includes(q);
        if (!matchesCode && !matchesIdent && !matchesMsg && !matchesSource) {
          return false;
        }
      }
      return true;
    });
  }, [events, categoryFilter, severityFilter, searchQuery]);

  const totalPages = Math.ceil(filteredEvents.length / pageSize) || 1;
  const paginatedEvents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredEvents.slice(start, start + pageSize);
  }, [filteredEvents, currentPage, pageSize]);

  const handleExport = () => {
    const jsonStr = exportEventsJson();
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `orbix-error-events-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getSeverityBadge = (severity: ErrorSeverity) => {
    switch (severity) {
      case "critical":
        return <Badge variant="outline" className="border-red-800/60 bg-red-950/20 text-red-400 font-mono text-[10px]">CRITICAL</Badge>;
      case "error":
        return <Badge variant="outline" className="border-rose-800/60 bg-rose-950/20 text-rose-400 font-mono text-[10px]">ERROR</Badge>;
      case "warning":
        return <Badge variant="outline" className="border-amber-800/60 bg-amber-950/20 text-amber-400 font-mono text-[10px]">WARNING</Badge>;
      default:
        return <Badge variant="outline" className="border-border bg-muted/40 text-muted-foreground font-mono text-[10px]">INFO</Badge>;
    }
  };

  const formatTimestamp = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) +
      " " +
      d.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  return (
    <div className="space-y-4 max-w-6xl mx-auto pb-10">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-muted-foreground" />
            <span>{isRu ? "Журнал ошибок и событий сети" : "Network Event & Error History"}</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isRu
              ? "Централизованный аудит сбоев, срабатываний защиты Kill Switch и системных событий"
              : "Centralized audit log of network failures, Kill Switch protection triggers, and diagnostics"}
          </p>
        </div>

        {/* Global Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={acknowledgeAll}
            className="h-8 px-2.5 text-xs font-medium gap-1.5 border-border bg-card text-foreground hover:bg-muted"
          >
            <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{isRu ? "Прочитать все" : "Mark All Read"}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            className="h-8 px-2.5 text-xs font-medium gap-1.5 border-border bg-card text-foreground hover:bg-muted"
          >
            <Download className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{isRu ? "Экспорт JSON" : "Export JSON"}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (confirm(isRu ? "Очистить журнал устраненных событий?" : "Clear history of resolved events?")) {
                clearHistory();
              }
            }}
            className="h-8 px-2.5 text-xs font-medium gap-1.5 border-border bg-card text-muted-foreground hover:text-red-500 hover:bg-muted"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>{isRu ? "Очистить" : "Clear"}</span>
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar Card */}
      <Card className="border-border bg-card text-card-foreground shadow-sm">
        <CardContent className="p-3">
          <div className="flex flex-col md:flex-row items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 w-full">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder={isRu ? "Поиск по коду, сообщению, источнику или идентификатору..." : "Search by code, message, source, or identifier..."}
                className="h-8 pl-8 pr-3 text-xs border-border bg-background text-foreground placeholder:text-muted-foreground"
              />
            </div>

            {/* Category Filter */}
            <div className="flex items-center gap-2 w-full md:w-auto">
              <select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-8 px-2.5 text-xs rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="all">{isRu ? "Все категории" : "All Categories"}</option>
                <option value="system">{isRu ? "Система (100–199)" : "System (100–199)"}</option>
                <option value="network">{isRu ? "Сеть (200–299)" : "Network (200–299)"}</option>
                <option value="routing">{isRu ? "Маршрутизация (300–399)" : "Routing (300–399)"}</option>
                <option value="security">{isRu ? "Безопасность (400–499)" : "Security (400–499)"}</option>
                <option value="vpn">{isRu ? "VPN и туннели (500–599)" : "VPN & Tunnels (500–599)"}</option>
                <option value="dns">{isRu ? "DNS (600–699)" : "DNS (600–699)"}</option>
                <option value="config">{isRu ? "Конфигурация (700–799)" : "Config (700–799)"}</option>
                <option value="services">{isRu ? "Службы (900–999)" : "Services (900–999)"}</option>
              </select>

              {/* Severity Filter */}
              <select
                value={severityFilter}
                onChange={(e) => {
                  setSeverityFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-8 px-2.5 text-xs rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="all">{isRu ? "Любая серьезность" : "All Severities"}</option>
                <option value="critical">Critical</option>
                <option value="error">Error</option>
                <option value="warning">Warning</option>
                <option value="info">Info</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Events Table Card */}
      <Card className="border-border bg-card text-card-foreground shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-border bg-muted/20 hover:bg-muted/20">
              <TableHead className="w-16 text-center text-xs">{isRu ? "Код" : "Code"}</TableHead>
              <TableHead className="w-24 text-xs">{isRu ? "Уровень" : "Severity"}</TableHead>
              <TableHead className="text-xs">{isRu ? "Идентификатор и описание" : "Identifier & Message"}</TableHead>
              <TableHead className="w-28 text-xs">{isRu ? "Источник" : "Source"}</TableHead>
              <TableHead className="w-40 text-xs">{isRu ? "Время" : "Timestamp"}</TableHead>
              <TableHead className="w-24 text-center text-xs">{isRu ? "Действия" : "Actions"}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedEvents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground text-xs">
                  {isRu
                    ? "События не найдены. Сеть работает в штатном режиме."
                    : "No matching events found. System is operating normally."}
                </TableCell>
              </TableRow>
            ) : (
              paginatedEvents.map((evt) => (
                <TableRow
                  key={evt.event_id}
                  onClick={() => setSelectedEvent(evt)}
                  className="border-b border-border/60 hover:bg-muted/40 cursor-pointer transition-colors"
                >
                  <TableCell className="font-mono text-center text-xs font-semibold text-foreground">
                    #{evt.code}
                  </TableCell>
                  <TableCell>
                    {getSeverityBadge(evt.severity)}
                  </TableCell>
                  <TableCell className="space-y-0.5">
                    <div className="font-mono text-[11px] font-semibold text-foreground flex items-center gap-2">
                      <span>{evt.identifier}</span>
                      {evt.repeatCount && evt.repeatCount > 1 ? (
                        <span className="text-[10px] px-1 py-0.2 rounded bg-muted text-muted-foreground font-mono">
                          ×{evt.repeatCount}
                        </span>
                      ) : null}
                    </div>
                    <div className="text-xs text-muted-foreground truncate max-w-lg">
                      {evt.message}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-[11px] text-muted-foreground">
                    {evt.source}
                  </TableCell>
                  <TableCell className="font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                    {formatTimestamp(evt.timestamp)}
                  </TableCell>
                  <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        window.location.hash = `#/errors/${evt.code}`;
                        if (onNavigate) onNavigate(`errors/${evt.code}`);
                      }}
                      className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted gap-1"
                      title={isRu ? "Диагностика ошибки" : "View Diagnostics"}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Pagination Bar */}
        <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
          <div>
            {isRu ? "Всего событий:" : "Total Events:"} <span className="font-mono text-foreground font-semibold">{filteredEvents.length}</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="h-7 w-7 border-border bg-card text-foreground disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="font-mono text-[11px]">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="h-7 w-7 border-border bg-card text-foreground disabled:opacity-40"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Event Details Dialog Modal */}
      <Dialog open={Boolean(selectedEvent)} onOpenChange={(open) => !open && setSelectedEvent(null)}>
        <DialogContent className="max-w-lg border-border bg-card text-card-foreground">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="font-mono text-xs border-border text-foreground">
                ORBIX #{selectedEvent?.code}
              </Badge>
              {selectedEvent && getSeverityBadge(selectedEvent.severity)}
            </div>
            <DialogTitle className="text-base font-bold text-foreground mt-2">
              {selectedEvent?.identifier}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {selectedEvent?.message}
            </DialogDescription>
          </DialogHeader>

          {selectedEvent && (
            <div className="space-y-3 py-2 text-xs font-mono">
              <div className="flex justify-between py-1 border-b border-border/40">
                <span className="text-muted-foreground">{isRu ? "ID события:" : "Event ID:"}</span>
                <span className="text-foreground">{selectedEvent.event_id}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/40">
                <span className="text-muted-foreground">{isRu ? "Источник:" : "Source:"}</span>
                <span className="text-foreground">{selectedEvent.source}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/40">
                <span className="text-muted-foreground">{isRu ? "Категория:" : "Category:"}</span>
                <span className="text-foreground">{selectedEvent.category.toUpperCase()}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/40">
                <span className="text-muted-foreground">{isRu ? "Время фиксации:" : "Registered At:"}</span>
                <span className="text-foreground">{formatTimestamp(selectedEvent.timestamp)}</span>
              </div>
              {selectedEvent.repeatCount && selectedEvent.repeatCount > 1 ? (
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">{isRu ? "Повторений:" : "Repetitions:"}</span>
                  <span className="text-foreground font-semibold">×{selectedEvent.repeatCount}</span>
                </div>
              ) : null}

              {selectedEvent.metadata && (
                <div className="space-y-1 pt-1">
                  <span className="text-muted-foreground font-medium text-[11px]">{isRu ? "Метаданные телеметрии:" : "Telemetry Metadata:"}</span>
                  <pre className="p-2.5 rounded bg-muted/40 border border-border text-[10px] overflow-x-auto text-foreground">
                    {JSON.stringify(selectedEvent.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex gap-2 sm:justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (selectedEvent) {
                  resolveEvent(selectedEvent.event_id);
                  setSelectedEvent(null);
                }
              }}
              className="text-xs border-border bg-card text-foreground"
            >
              {isRu ? "Пометить как устраненное" : "Mark Resolved"}
            </Button>

            <Button
              size="sm"
              onClick={() => {
                if (selectedEvent) {
                  window.location.hash = `#/errors/${selectedEvent.code}`;
                  if (onNavigate) onNavigate(`errors/${selectedEvent.code}`);
                  setSelectedEvent(null);
                }
              }}
              className="text-xs bg-foreground text-background hover:bg-foreground/90 gap-1.5"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>{isRu ? "Открыть диагностику" : "Full Diagnostics"}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
