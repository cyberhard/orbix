import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ubusClient } from "@/lib/ubus-client";
import { ZapretHealth } from "./ZapretHealth";
import { useI18nStore } from "@/store/i18n-store";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Play,
  Upload,
  RotateCcw,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  FileCode2,
  Archive,
  FileUp,
} from "lucide-react";
import {
  parseZapretBat,
  ParsedZapretBat,
  batNameToProfileName,
  importFileName,
} from "@/services/zapret/bat-parser";
import { FLOWSEAL_PRESETS } from "@/services/zapret/presets";

interface Feedback {
  kind: "ok" | "err" | "info";
  text: string;
}

export const ZapretStrategyBuilder: React.FC = () => {
  const { t, lang } = useI18nStore();
  const L = (ru: string, en: string) => (lang === "ru" ? ru : en);
  const queryClient = useQueryClient();

  // ---------- live config from the router ----------
  const [pendingRestart, setPendingRestart] = useState(false);
  const {
    data: opts,
    isLoading,
    error: optsError,
  } = useQuery({
    queryKey: ["zapret-options"],
    queryFn: () => ubusClient.getZapretOptions(),
    refetchInterval: pendingRestart ? 3000 : false,
  });

  // draft editor state
  const [optText, setOptText] = useState("");
  const [portsTcp, setPortsTcp] = useState("");
  const [portsUdp, setPortsUdp] = useState("");
  const [modeFilter, setModeFilter] = useState("hostlist");
  const [enable, setEnable] = useState(false);
  const [onBoot, setOnBoot] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [applying, setApplying] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const loadDraft = React.useCallback(() => {
    if (!opts) return;
    setOptText(opts.nfqws_opt);
    setPortsTcp(opts.ports_tcp);
    setPortsUdp(opts.ports_udp);
    setModeFilter(opts.mode_filter || "hostlist");
    setEnable(opts.nfqws_enable);
    setOnBoot(opts.run_on_boot === "1");
    setDirty(false);
  }, [opts]);

  useEffect(() => {
    if (opts && !dirty) loadDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts]);

  // when restart completes, tell the user the truth and stop polling
  useEffect(() => {
    if (pendingRestart && opts) {
      if (opts.running) {
        setPendingRestart(false);
        setFeedback({
          kind: "ok",
          text: L("nfqws снова работает — новая конфигурация активна.", "nfqws is running again — new config is live."),
        });
        queryClient.invalidateQueries({ queryKey: ["zapret-options"] });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingRestart, opts?.running]);

  useEffect(() => {
    if (!pendingRestart) return;
    const to = setTimeout(() => {
      setPendingRestart(false);
      setFeedback({
        kind: "err",
        text: L(
          "Перезапуск не завершился за 2 минуты. Откройте /tmp/zapret-panel-restart.log на роутере — возможно, nfqws не стартует с новой стратегией; есть бэкап в разделе «Списки и бэкапы».",
          "Restart did not settle within 2 minutes. Check /tmp/zapret-panel-restart.log on the router — nfqws may fail with the new strategy; a backup is in the Lists & Backups section."
        ),
      });
    }, 120000);
    return () => clearTimeout(to);
  }, [pendingRestart]);

  // ---------- .bat import state ----------
  const [parsed, setParsed] = useState<ParsedZapretBat | null>(null);
  const [batSource, setBatSource] = useState<string>("");
  const [companions, setCompanions] = useState<Record<string, string>>({});
  const [profileName, setProfileName] = useState("imported");
  const [importMode, setImportMode] = useState<"replace" | "append">("append");
  const [ignoreMissing, setIgnoreMissing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState("");

  const runParse = (
    bat: string,
    companionMap: Record<string, string>,
    routerFiles: string[]
  ) => {
    setParsed(parseZapretBat(bat, { companionFiles: companionMap, routerListFiles: routerFiles }));
  };

  const loadPreset = (bat: string, name: string) => {
    setBatSource(bat);
    setProfileName(batNameToProfileName(name + ".bat"));
    runParse(bat, companions, (opts?.list_files || []).map((f: { name: string }) => f.name));
    setFeedback(null);
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newCompanions = { ...companions };
    let bat: string | null = null;
    let batName = "";
    for (const f of Array.from(files)) {
      const text = await f.text();
      if (/\.bat$|\.cmd$/i.test(f.name)) {
        bat = text;
        batName = f.name;
      } else if (/\.txt$|\.lst$/i.test(f.name)) {
        newCompanions[f.name] = text;
      }
    }
    if (bat) {
      setBatSource(bat);
      setCompanions(newCompanions);
      setProfileName(batNameToProfileName(batName));
      runParse(bat, newCompanions, (opts?.list_files || []).map((f: { name: string }) => f.name));
      setFeedback(null);
    } else {
      setCompanions(newCompanions);
      if (batSource) runParse(batSource, newCompanions, (opts?.list_files || []).map((f: { name: string }) => f.name));
      setFeedback({ kind: "info", text: L("Файлы списков загружены — добавьте .bat со стратегией.", "List files loaded — add a .bat with the strategy.") });
    }
  };

  const missingBlocking =
    !!parsed && parsed.needsUpload.length > 0 && parsed.needsUpload.every((b) => companions[b] === undefined) && !ignoreMissing;

  const handleApplyDraft = async () => {
    if (!dirty) return;
    if (
      !window.confirm(
        L(
          "Записать конфигурацию в /etc/config/zapret и перезапустить zapret? Трафик на время перезапуска (секунды) пойдёт напрямую. Текущая конфигурация будет сохранена в бэкап.",
          "Write to /etc/config/zapret and restart zapret? Traffic will pass unfiltered for a few seconds during restart. Current config will be backed up."
        )
      )
    )
      return;
    setApplying(true);
    setFeedback(null);
    try {
      const res = await ubusClient.setZapretOptions({
        nfqws_enable: enable ? "1" : "0",
        ports_tcp: portsTcp,
        ports_udp: portsUdp,
        mode_filter: modeFilter,
        run_on_boot: onBoot ? "1" : "0",
        nfqws_opt: optText,
        restart: 1,
      });
      if (res.restart_started) {
        setPendingRestart(true);
        setFeedback({ kind: "info", text: L("Записано и commit прошёл. Перезапускаю zapret...", "Written and committed. Restarting zapret...") });
      } else {
        setFeedback({ kind: "ok", text: L("Записано (перезапуск не запрошен).", "Written (restart not requested).") });
      }
      setDirty(false);
    } catch (e: any) {
      setFeedback({ kind: "err", text: `${L("Ошибка записи:", "Write failed:")} ${e?.message || String(e)}` });
    } finally {
      setApplying(false);
    }
  };

  const handleImportApply = async () => {
    if (!parsed || !batSource) return;
    setImporting(true);
    setFeedback(null);
    try {
      const filesOnRouter: string[] = [];
      // upload every companion list under a unique import name (never clobbers package lists)
      for (const ref of parsed.fileRefs) {
        if (ref.kind !== "list") continue;
        const content = companions[ref.basename];
        if (content === undefined) continue;
        const target = importFileName(profileName, ref.basename);
        setImportProgress(L(`Загружаю ${target}...`, `Uploading ${target}...`));
        await ubusClient.uploadZapretList(target, content);
        filesOnRouter.push(target);
      }
      setImportProgress(L("Записываю профиль...", "Writing profile..."));
      const mapping: Record<string, string> = {};
      for (const ref of parsed.fileRefs) {
        if (ref.kind === "list" && companions[ref.basename] !== undefined) {
          mapping[ref.basename] = importFileName(profileName, ref.basename);
        }
      }
      // rewrite uploaded refs into the opt text before sending
      let finalOpt = parsed.nfqwsOpt;
      for (const [orig, target] of Object.entries(mapping)) {
        finalOpt = finalOpt.split(`${ref0(orig)}`).join(`/opt/zapret/ipset/${target}`);
      }
      const res = await ubusClient.importZapretProfile({
        name: profileName,
        nfqws_opt: finalOpt,
        ports_tcp: parsed.portsTcp,
        ports_udp: parsed.portsUdp,
        mode: importMode,
        files: filesOnRouter,
        restart: 1,
      });
      setImportProgress("");
      setPendingRestart(true);
      setFeedback({
        kind: "info",
        text: L(
          `Профиль «${profileName}» записан (${importMode === "append" ? L("добавлен секциями --new", "appended as --new sections") : L("заменил NFQWS_OPT полностью", "replaced NFQWS_OPT entirely")})${
            res.written?.length ? `, списков записано: ${res.written.length}` : ""
          }. Перезапускаю zapret...`,
          `Profile "${profileName}" written${res.written?.length ? `, ${res.written.length} lists uploaded` : ""}. Restarting zapret...`
        ),
      });
    } catch (e: any) {
      setImportProgress("");
      setFeedback({ kind: "err", text: `${L("Ошибка импорта:", "Import failed:")} ${e?.message || String(e)}` });
    } finally {
      setImporting(false);
    }
  };

  // helper used in path rewrite (kept tiny): the parser emits routerPath with the original basename
  function ref0(bn: string) {
    return `/opt/zapret/ipset/${bn}`;
  }

  const handleRestore = async (file: string) => {
    if (!window.confirm(L(`Восстановить конфигурацию из ${file} и перезапустить zapret?`, `Restore config from ${file} and restart zapret?`))) return;
    try {
      setFeedback({ kind: "info", text: L("Восстанавливаю...", "Restoring...") });
      await ubusClient.restoreZapretBackup(file);
      setPendingRestart(true);
      setFeedback({ kind: "info", text: L(`Восстановлен ${file}, перезапускаю zapret...`, `Restored ${file}, restarting zapret...`) });
    } catch (e: any) {
      setFeedback({ kind: "err", text: `${L("Восстановление не удалось:", "Restore failed:")} ${e?.message || String(e)}` });
    }
  };

  // ---------- probe (real router-side TCP/TLS probe) ----------
  const [testDomain, setTestDomain] = useState("youtube.com");
  const [testResult, setTestResult] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const handleRunStrategyTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await ubusClient.testZapretStrategy(testDomain.trim() || "youtube.com");
      if (res.verified) {
        setTestResult(
          L(
            `ЗОНД С РОУТЕРА ПРОШЁЛ: https://${res.target}\nHTTP ${res.http_code}\nTCP: ${res.connect_time_ms} ms\nTLS: ${res.tls_handshake_ms} ms\nВсего: ${res.total_time_ms} ms`,
            `ROUTER PROBE PASSED: https://${res.target}\nHTTP ${res.http_code}\nTCP: ${res.connect_time_ms} ms\nTLS: ${res.tls_handshake_ms} ms\nTotal: ${res.total_time_ms} ms`
          )
        );
      } else {
        setTestResult(L(`НЕ ПРОШЛО: ${res.message || "соединение не установлено"}\nЦель: ${res.target}`, `FAILED: ${res.message || "no connection"}\nTarget: ${res.target}`));
      }
    } catch (e: any) {
      setTestResult(L(`ОШИБКА ЗОНДА: ${e?.message || String(e)}`, `PROBE ERROR: ${e?.message || String(e)}`));
    } finally {
      setIsTesting(false);
    }
  };

  // ---------- render ----------
  if (isLoading) {
    return <div className="p-8 text-center text-xs text-muted-foreground">{L("Читаю /etc/config/zapret...", "Reading /etc/config/zapret...")}</div>;
  }
  if (optsError) {
    return (
      <div className="p-6 space-y-3">
        <h2 className="text-base font-bold text-foreground">{t.zapret.title}</h2>
        <div className="p-4 rounded-lg border border-destructive/50 bg-destructive/10 text-destructive text-xs font-mono">
          {String((optsError as any)?.message || optsError)}
        </div>
      </div>
    );
  }
  if (opts && !opts.installed) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-bold text-foreground">{t.zapret.title}</h2>
          <p className="text-xs text-muted-foreground">{t.zapret.subtitle}</p>
        </div>
        <div className="p-4 rounded-lg border border-amber-800/50 bg-amber-950/20 text-amber-300/90 text-[11px] space-y-1">
          <div className="font-semibold">{L("Zapret на роутере не обнаружен", "Zapret not detected on the router")}</div>
          <p className="text-zinc-400">
            {L(
              "/etc/config/zapret не найден. Страница оживёт, как только zapret будет установлен (пакет zapret + /opt/zapret).",
              "/etc/config/zapret was not found. This page becomes live once zapret is installed (zapret package + /opt/zapret)."
            )}
          </p>
        </div>
      </div>
    );
  }

  const fbClass =
    feedback?.kind === "err"
      ? "border-destructive/50 bg-destructive/10 text-destructive"
      : feedback?.kind === "ok"
        ? "border-emerald-600/50 bg-emerald-950/30 text-emerald-300"
        : "border-sky-700/50 bg-sky-950/30 text-sky-300";

  return (
    <div className="space-y-5">
      {/* Header + live status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-foreground">{t.zapret.title}</h2>
          <p className="text-xs text-muted-foreground">{t.zapret.subtitle}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={opts?.running ? "outline" : "destructive"} className="text-[10px] font-mono gap-1">
            {opts?.running ? <CheckCircle2 className="h-3 w-3 text-emerald-400" /> : <AlertTriangle className="h-3 w-3" />}
            nfqws {opts?.running ? "running" : "stopped"}
          </Badge>
          <Badge variant="outline" className="text-[10px] font-mono">
            {opts?.fwtype || "?"} · {opts?.mode_filter}
          </Badge>
          {pendingRestart && (
            <Badge variant="outline" className="text-[10px] font-mono gap-1 border-amber-500/60 text-amber-400">
              <Loader2 className="h-3 w-3 animate-spin" /> {L("перезапуск...", "restarting...")}
            </Badge>
          )}
        </div>
      </div>

      {/* Real-write banner */}
      <div className="p-3 rounded-lg border border-emerald-800/40 bg-emerald-950/15 text-emerald-300/90 text-[11px]">
        {L(
          "Эта страница читает и пишет живой /etc/config/zapret. Кнопка «Применить» выполняет uci set → commit → /etc/init.d/zapret restart и показывает настоящий результат. Перед любой записью конфигурация сохраняется в бэкап.",
          "This page reads and writes the live /etc/config/zapret. Apply performs uci set → commit → /etc/init.d/zapret restart and reports the real outcome. Every write is preceded by a config backup."
        )}
      </div>

      <ZapretHealth />

      {feedback && (
        <div className={`p-3 rounded-lg border text-[11px] font-mono whitespace-pre-wrap ${fbClass}`} onClick={() => setFeedback(null)}>
          {feedback.text}
        </div>
      )}

      {/* ===== Import .bat ===== */}
      <Card>
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <FileUp className="h-4 w-4 text-primary" />
            {L("Импорт .bat из zapret-discord-youtube (Flowseal)", "Import .bat from zapret-discord-youtube (Flowseal)")}
          </CardTitle>
          <CardDescription>
            {L(
              "Загрузите general*.bat (можно и .txt-списки рядом — они записываются на роутер). winws-флаги конвертируются в nfqws, пути %LISTS%/%BIN% — в /opt/zapret.",
              "Upload general*.bat (optionally its .txt lists — they get written to the router). winws flags convert to nfqws; %LISTS%/%BIN% paths map to /opt/zapret."
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              id="zapret-bat-input"
              type="file"
              multiple
              accept=".bat,.cmd,.txt,.lst"
              onChange={(e) => handleFiles(e.target.files)}
              className="hidden"
            />
            <label htmlFor="zapret-bat-input">
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" asChild>
                <span className="cursor-pointer">
                  <Upload className="h-3.5 w-3.5" /> {L("Выбрать .bat / .txt", "Pick .bat / .txt")}
                </span>
              </Button>
            </label>
            <span className="text-[10px] text-muted-foreground">{L("или встроенные:", "or built-in:")}</span>
            {FLOWSEAL_PRESETS.map((p) => (
              <Button key={p.id} variant="ghost" size="sm" className="h-7 text-[10px]" onClick={() => loadPreset(p.bat, p.id)} title={p.description}>
                {p.label}
              </Button>
            ))}
          </div>

          {parsed && (
            <div className="space-y-3 rounded-lg border border-border/60 bg-background/40 p-3">
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <Badge variant="outline" className="font-mono text-[10px]">{parsed.engine}</Badge>
                <span className="font-mono text-muted-foreground">tcp[{parsed.portsTcp || "—"}]</span>
                <span className="font-mono text-muted-foreground">udp[{parsed.portsUdp || "—"}]</span>
                <span className="font-mono text-muted-foreground">{parsed.sections.length} {L("секций", "sections")}</span>
              </div>

              {parsed.warnings.length > 0 && (
                <ul className="space-y-0.5">
                  {parsed.warnings.map((w, i) => (
                    <li key={i} className="text-[10px] text-amber-400/90 flex gap-1.5">
                      <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" /> {w}
                    </li>
                  ))}
                </ul>
              )}

              {parsed.fileRefs.length > 0 && (
                <div className="grid gap-1 max-h-32 overflow-y-auto">
                  {parsed.fileRefs.map((f, i) => (
                    <div key={i} className="flex items-center justify-between text-[10px] font-mono rounded bg-black/30 px-2 py-1">
                      <span className="truncate">{f.basename}</span>
                      <Badge
                        variant="outline"
                        className={`text-[9px] ${
                          f.status === "router_exists"
                            ? "border-emerald-600/60 text-emerald-400"
                            : f.status === "uploaded"
                              ? "border-sky-600/60 text-sky-400"
                              : "border-destructive/60 text-destructive"
                        }`}
                      >
                        {f.status === "router_exists"
                          ? L("есть на роутере", "on router")
                          : f.status === "uploaded"
                            ? L(`загружен${f.domainCount !== undefined ? ` (${f.domainCount} доменов)` : ""}`, `uploaded${f.domainCount !== undefined ? ` (${f.domainCount} domains)` : ""}`)
                            : f.kind === "payload"
                              ? L("бинарник пакета", "package binary")
                              : L("нет — нужен файл рядом", "missing — needs companion")}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}

              <details className="text-[10px]">
                <summary className="cursor-pointer text-muted-foreground font-mono">{L("предпросмотр NFQWS_OPT", "preview NFQWS_OPT")}</summary>
                <pre className="mt-2 max-h-48 overflow-auto bg-black/50 rounded p-2 font-mono text-[10px] text-emerald-300 whitespace-pre-wrap">
                  {parsed.nfqwsOpt}
                </pre>
              </details>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Input value={profileName} onChange={(e) => setProfileName(batNameToProfileName(e.target.value))} className="h-8 w-40 text-xs font-mono" placeholder="profile name" />
                <select
                  value={importMode}
                  onChange={(e) => setImportMode(e.target.value as "replace" | "append")}
                  className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                >
                  <option value="append">{L("добавить секции (--new)", "append sections (--new)")}</option>
                  <option value="replace">{L("заменить NFQWS_OPT полностью", "replace NFQWS_OPT entirely")}</option>
                </select>
                {parsed.needsUpload.length > 0 && (
                  <label className="flex items-center gap-1.5 text-[10px] text-amber-400">
                    <input type="checkbox" checked={ignoreMissing} onChange={(e) => setIgnoreMissing(e.target.checked)} />
                    {L(`всё равно применить (списков нет: ${parsed.needsUpload.join(", ")})`, `apply anyway (missing lists: ${parsed.needsUpload.join(", ")})`)}
                  </label>
                )}
                <Button size="sm" className="h-8 text-xs gap-1.5 ml-auto" onClick={handleImportApply} disabled={!parsed.sections.length || importing || missingBlocking}>
                  {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  {importProgress || L("Записать на роутер и перезапустить", "Write to router and restart")}
                </Button>
              </div>
              {missingBlocking && (
                <p className="text-[10px] text-destructive">
                  {L("Списки не найдены на роутере и не загружены рядом с .bat: секции с --hostlist по ним не запустятся. Приложите .txt из архива Flowseal или отметьте «всё равно применить».", "Lists missing on the router and no companion .txt: --hostlist sections will not start. Attach the .txt files from the Flowseal archive or tick apply-anyway.")}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===== Live config editor ===== */}
      <Card>
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FileCode2 className="h-4 w-4 text-primary" />
                {L("Конфигурация zapret на роутере", "Live zapret config on the router")}
              </CardTitle>
              <CardDescription>
                {L("Читается /etc/config/zapret (NFQWS_OPT, порты, режим фильтрации). Правка = запись после «Применить».", "Reads /etc/config/zapret (NFQWS_OPT, ports, filtering mode). Edits are written on Apply.")}
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                nfqws
                <Switch checked={enable} onCheckedChange={(v) => { setEnable(v); setDirty(true); }} />
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                run_on_boot
                <Switch checked={onBoot} onCheckedChange={(v) => { setOnBoot(v); setDirty(true); }} />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <label className="text-[10px] font-mono text-muted-foreground">NFQWS_PORTS_TCP</label>
              <Input value={portsTcp} onChange={(e) => { setPortsTcp(e.target.value); setDirty(true); }} className="h-8 text-xs font-mono" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-mono text-muted-foreground">NFQWS_PORTS_UDP</label>
              <Input value={portsUdp} onChange={(e) => { setPortsUdp(e.target.value); setDirty(true); }} className="h-8 text-xs font-mono" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-mono text-muted-foreground">MODE_FILTER</label>
              <select
                value={modeFilter}
                onChange={(e) => { setModeFilter(e.target.value); setDirty(true); }}
                className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs font-mono"
              >
                <option value="hostlist">hostlist</option>
                <option value="auto_hostlist">auto_hostlist</option>
                <option value="non_tcp">non_tcp</option>
                <option value="raw">raw</option>
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-mono text-muted-foreground">NFQWS_OPT</label>
              <span className="text-[10px] text-muted-foreground font-mono">{optText.length} B</span>
            </div>
            <textarea
              value={optText}
              onChange={(e) => { setOptText(e.target.value); setDirty(true); }}
              spellCheck={false}
              className="w-full min-h-56 rounded-md border border-input bg-black/50 p-3 font-mono text-[11px] leading-relaxed text-emerald-300 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {dirty && <span className="text-[10px] text-amber-400 mr-auto">{L("незаписанные изменения", "unsaved changes")}</span>}
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={loadDraft}>
              <RotateCcw className="h-3.5 w-3.5" /> {L("Перечитать с роутера", "Reload from router")}
            </Button>
            <Button size="sm" className="h-8 text-xs gap-1.5" onClick={handleApplyDraft} disabled={!dirty || applying || pendingRestart}>
              {applying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              {L("Применить и перезапустить", "Apply and restart")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ===== Lists & Backups + probe ===== */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2 border-b">
            <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
              <Archive className="h-3.5 w-3.5 text-muted-foreground" />
              {L("Списки на роутере и бэкапы конфига", "Router lists & config backups")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-3">
            <div className="max-h-40 overflow-y-auto grid gap-1">
              {(opts?.list_files || []).map((f: { name: string; path: string; size: number }) => (
                <div key={f.path} className="flex items-center justify-between text-[10px] font-mono rounded bg-black/30 px-2 py-1">
                  <span className="truncate">{f.name}</span>
                  <span className="text-muted-foreground">{(f.size / 1024).toFixed(1)} KiB</span>
                </div>
              ))}
            </div>
            <div className="max-h-40 overflow-y-auto grid gap-1 border-t pt-2">
              {(opts?.backups || []).length === 0 && <span className="text-[10px] text-muted-foreground">{L("бэкапов пока нет", "no backups yet")}</span>}
              {[...(opts?.backups || [])].reverse().map((b) => (
                <div key={b} className="flex items-center justify-between gap-2 text-[10px] font-mono rounded bg-black/30 px-2 py-1">
                  <span className="truncate">{b}</span>
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] gap-1 shrink-0" onClick={() => handleRestore(b)}>
                    <RotateCcw className="h-3 w-3" /> {L("вернуть", "restore")}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 border-b">
            <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
              <Play className="h-3.5 w-3.5 text-primary" />
              {L("Реальный зонд с роутера", "Real probe from the router")}
            </CardTitle>
            <CardDescription>{L("TCP/TLS-подключение к цели прямо с роутера — проверяет РАБОТАЮЩИЙ zapret, а не черновик в редакторе.", "TCP/TLS connection straight from the router — validates the RUNNING zapret, not the editor draft.")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-3">
            <div className="flex gap-2">
              <Input value={testDomain} onChange={(e) => setTestDomain(e.target.value)} placeholder="youtube.com" className="font-mono text-xs h-8" />
              <Button variant="default" size="sm" onClick={handleRunStrategyTest} disabled={isTesting} className="h-8 text-xs">
                {isTesting ? L("идёт зонд...", "probing...") : L("Зонд", "Probe")}
              </Button>
            </div>
            {testResult && (
              <div className={`rounded-md border p-2.5 font-mono text-[10px] whitespace-pre-wrap ${testResult.startsWith(L("НЕ ПРОШЛО", "FAILED")) ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"}`}>
                {testResult}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
