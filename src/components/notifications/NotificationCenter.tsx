// ORBIX Notification Center
// Follows strictly shadcn/ui Zinc design specifications
import React, { useState, useRef, useEffect } from "react";
import { Bell, CheckCheck, ExternalLink, ShieldAlert, AlertTriangle, AlertCircle, Info, Trash2 } from "lucide-react";
import { useErrorStore } from "@/store/error-store";
import { useI18nStore } from "@/store/i18n-store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorSeverity } from "@/types/errors";
import { getErrorByCode } from "@/services/error/error-registry";

export const NotificationCenter: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { lang } = useI18nStore();
  const isRu = lang === "ru";

  const {
    events,
    getUnreadCount,
    acknowledgeEvent,
    acknowledgeAll,
    resolveEvent,
    clearHistory,
  } = useErrorStore();

  const unreadCount = getUnreadCount();
  const recentEvents = events.slice(0, 10);

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isOpen]);

  const getSeverityIcon = (severity: ErrorSeverity) => {
    switch (severity) {
      case "critical":
        return <ShieldAlert className="h-4 w-4 text-red-500 shrink-0" />;
      case "high":
        return <AlertCircle className="h-4 w-4 text-orange-500 shrink-0" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />;
      default:
        return <Info className="h-4 w-4 text-zinc-400 shrink-0" />;
    }
  };

  const getSeverityBadge = (severity: ErrorSeverity) => {
    switch (severity) {
      case "critical":
        return "bg-red-500/10 text-red-500 border-red-500/30";
      case "high":
        return "bg-orange-500/10 text-orange-500 border-orange-500/30";
      case "warning":
        return "bg-amber-500/10 text-amber-500 border-amber-500/30";
      default:
        return "bg-zinc-500/10 text-zinc-400 border-zinc-500/30";
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        className="relative h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted shrink-0"
        title={isRu ? "Центр событий и уведомлений" : "Notification Center"}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white shadow-xs animate-in zoom-in-50">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-border bg-card text-card-foreground shadow-xl z-50 overflow-hidden animate-in fade-in-50 slide-in-from-top-2">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-muted/30">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-foreground">
                {isRu ? "Центр уведомлений" : "Notifications"}
              </span>
              {unreadCount > 0 && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-red-500/30 bg-red-500/10 text-red-500">
                  {unreadCount} {isRu ? "новых" : "new"}
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={acknowledgeAll}
                  className="h-7 px-2 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
                  title={isRu ? "Прочитать все" : "Mark all read"}
                >
                  <CheckCheck className="h-3 w-3" />
                  <span className="hidden sm:inline">{isRu ? "Прочитать" : "Read all"}</span>
                </Button>
              )}
              {events.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={clearHistory}
                  className="h-7 w-7 text-muted-foreground hover:text-red-500"
                  title={isRu ? "Очистить список" : "Clear list"}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>

          {/* Event Items List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-border/60">
            {recentEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                <Bell className="h-8 w-8 stroke-1 text-muted-foreground/40 mb-2" />
                <p className="text-xs font-medium text-foreground">{isRu ? "Все спокойно" : "No new alerts"}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {isRu ? "Сетевых сбоев и алертов не зафиксировано" : "System operates within normal parameters"}
                </p>
              </div>
            ) : (
              recentEvents.map((ev) => {
                const isUnread = !ev.acknowledged;
                const def = getErrorByCode(ev.code);
                const title = def?.title ? def.title[isRu ? "ru" : "en"] : ev.message;
                const desc = def?.description ? def.description[isRu ? "ru" : "en"] : ev.message;
                return (
                  <div
                    key={ev.event_id}
                    className={`p-3 text-xs transition-colors hover:bg-muted/40 ${
                      isUnread ? "bg-muted/15" : ""
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5">{getSeverityIcon(ev.severity)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-semibold text-foreground truncate">
                            {title}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                            {new Date(ev.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>

                        <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">
                          {desc}
                        </p>

                        <div className="flex items-center justify-between mt-2 pt-1">
                          <div className="flex items-center gap-1.5">
                            <span className={`inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-mono border ${getSeverityBadge(ev.severity)}`}>
                              ERR-{ev.code}
                            </span>
                            {ev.repeat_count > 1 && (
                              <Badge variant="outline" className="text-[9px] px-1 py-0 border-border text-muted-foreground">
                                ×{ev.repeat_count}
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            {isUnread && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => acknowledgeEvent(ev.event_id)}
                                className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                              >
                                {isRu ? "ОК" : "Ack"}
                              </Button>
                            )}
                            <a
                              href={`#/errors/${ev.code}`}
                              onClick={() => setIsOpen(false)}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-sky-400 hover:text-sky-300 hover:bg-sky-500/10"
                            >
                              <span>{isRu ? "Инструкция" : "Details"}</span>
                              <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-border p-2 bg-muted/20 text-center">
            <a
              href="#/system/errors"
              onClick={() => setIsOpen(false)}
              className="inline-flex items-center justify-center w-full py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors gap-1.5"
            >
              <span>{isRu ? "Открыть полный журнал ошибок" : "View Error History & Audit"}</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
};
