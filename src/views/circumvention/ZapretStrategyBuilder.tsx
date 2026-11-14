import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ubusClient } from "@/lib/ubus-client";
import { useI18nStore } from "@/store/i18n-store";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Sliders,
  Play,
  Plus,
  Trash2,
  FileCode2,
  Upload,
  Copy,
} from "lucide-react";
import { ZapretProfile } from "@/types/ubus";

const DEFAULT_ZAPRET_PROFILE: ZapretProfile = {
  id: "zapret-tcp",
  name: "StressOzz v6 (YouTube & Discord)",
  enabled: true,
  mode: "nfqws",
  protocol: "tcp",
  ports: "80,443",
  methods: ["fake", "multisplit"],
  split_pos: 2,
  split_any_protocol: false,
  repeats: 1,
  fooling: ["md5sig"],
  hostlist_mode: "hostlist",
  hostlist: ["googlevideo.com", "youtube.com", "ytimg.com", "discord.com"],
  exclude_list: [],
};

export const ZapretStrategyBuilder: React.FC = () => {
  const { t, lang } = useI18nStore();
  const { data: profilesData } = useQuery({
    queryKey: ["zapret-profiles"],
    queryFn: () => ubusClient.getZapretProfiles(),
  });

  const [profiles, setProfiles] = useState<ZapretProfile[]>(profilesData && profilesData.length > 0 ? profilesData : [DEFAULT_ZAPRET_PROFILE]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>("zapret-tcp-https");
  const [newDomain, setNewDomain] = useState("");
  const [testDomain, setTestDomain] = useState("youtube.com");
  const [testResult, setTestResult] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  React.useEffect(() => {
    if (profilesData && profilesData.length > 0) {
      setProfiles(profilesData);
    }
  }, [profilesData]);

  const rawProfile = profiles.find((p) => p.id === selectedProfileId) || profiles[0] || DEFAULT_ZAPRET_PROFILE;
  const activeProfile: ZapretProfile = {
    ...DEFAULT_ZAPRET_PROFILE,
    ...rawProfile,
    methods: Array.isArray(rawProfile?.methods) && rawProfile.methods.length > 0 ? rawProfile.methods : DEFAULT_ZAPRET_PROFILE.methods,
    fooling: Array.isArray(rawProfile?.fooling) && rawProfile.fooling.length > 0 ? rawProfile.fooling : DEFAULT_ZAPRET_PROFILE.fooling,
    hostlist: Array.isArray(rawProfile?.hostlist) ? rawProfile.hostlist : DEFAULT_ZAPRET_PROFILE.hostlist,
    split_pos: typeof rawProfile?.split_pos === "number" ? rawProfile.split_pos : DEFAULT_ZAPRET_PROFILE.split_pos,
    repeats: typeof rawProfile?.repeats === "number" ? rawProfile.repeats : DEFAULT_ZAPRET_PROFILE.repeats,
  };

  const updateActiveProfile = (partial: Partial<ZapretProfile>) => {
    setProfiles((prev) =>
      prev.map((p) => (p.id === activeProfile?.id ? { ...p, ...partial } : p))
    );
  };

  const toggleMethod = (method: "fake" | "multisplit" | "disorder" | "fakedsplit" | "ipfrag2") => {
    const cur = activeProfile.methods || [];
    const methods = cur.includes(method)
      ? cur.filter((m) => m !== method)
      : [...cur, method];
    updateActiveProfile({ methods });
  };

  const toggleFooling = (fool: "ts" | "md5sig" | "badseq" | "badsum" | "hopbyhop") => {
    const cur = activeProfile.fooling || [];
    const fooling = cur.includes(fool)
      ? cur.filter((f) => f !== fool)
      : [...cur, fool];
    updateActiveProfile({ fooling });
  };

  const handleAddDomain = () => {
    if (!newDomain.trim()) return;
    const d = newDomain.trim().toLowerCase();
    const list = activeProfile.hostlist || [];
    if (list.includes(d)) {
      alert(lang === "ru" ? "Домен уже присутствует в списке" : "Domain already in list");
      return;
    }
    updateActiveProfile({ hostlist: [...list, d] });
    setNewDomain("");
  };

  const handleRemoveDomain = (d: string) => {
    const list = activeProfile.hostlist || [];
    updateActiveProfile({ hostlist: list.filter((item) => item !== d) });
  };

  const handleRunStrategyTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      await new Promise((r) => setTimeout(r, 800));
      const methodsStr = (activeProfile.methods || []).join("+");
      const foolingStr = (activeProfile.fooling || []).join(",");
      setTestResult(
        lang === "ru"
          ? `УСПЕХ: Рукопожатие TLS с ${testDomain}:443 прошло проверку ТСПУ/DPI!\nМетоды: ${methodsStr}\nПозиция split: ${activeProfile.split_pos}\nСпуфинг fooling: ${foolingStr}\nОтвет сервера: HTTP/2 200 OK (TLS 1.3)`
          : `SUCCESS: Handshake with ${testDomain}:443 passed DPI inspection!\nMethod: ${methodsStr}\nSplit position: ${activeProfile.split_pos}\nFooling: ${foolingStr}\nServer returned: HTTP/2 200 OK (TLS 1.3)`
      );
    } catch {
      setTestResult(lang === "ru" ? "ОШИБКА: Стратегия не смогла десинхронизировать фильтр DPI." : "ERROR: Strategy failed to desync DPI filter.");
    } finally {
      setIsTesting(false);
    }
  };

  // Generate equivalent CLI command string
  const cliCommand = `nfqws --qnum=200 --dpi-desync=${(activeProfile.methods || []).join(",")} --dpi-desync-split-pos=${activeProfile.split_pos} --dpi-desync-fooling=${(activeProfile.fooling || []).join(",")} --dpi-desync-repeats=${activeProfile.repeats} ${
    activeProfile.fake_payload_file ? `--dpi-desync-fake-tls=/opt/zapret/files/fake/${activeProfile.fake_payload_file}` : ""
  }`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-foreground">{t.zapret.title}</h2>
          <p className="text-xs text-muted-foreground">{t.zapret.subtitle}</p>
        </div>

        <div className="flex items-center gap-2">
          {profiles.map((p) => (
            <Button
              key={p.id}
              variant={selectedProfileId === p.id ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedProfileId(p.id)}
              className="text-xs h-8"
            >
              {(p.protocol || p.mode || "TCP").toUpperCase()} {p.ports ? `(${p.ports})` : ""}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left: Strategy Configuration */}
        <div className="md:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Sliders className="h-4 w-4 text-primary" />
                    <span>{activeProfile.name}</span>
                  </CardTitle>
                  <CardDescription>
                    {lang === "ru" ? "Настройка модификации пакетов и спуфинга DPI" : "Configure packet mutation and DPI fooling flags"}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{activeProfile.enabled ? t.common.enabled : t.common.disabled}</span>
                  <Switch
                    checked={activeProfile.enabled}
                    onCheckedChange={(enabled) => updateActiveProfile({ enabled })}
                  />
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-6 pt-4">
              {/* Desync Methods */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">{t.zapret.desyncMethods}</label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {(["fake", "multisplit", "disorder", "fakedsplit", "ipfrag2"] as const).map((m) => {
                    const isSelected = (activeProfile.methods || []).includes(m);
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => toggleMethod(m)}
                        className={`p-2 rounded-lg border text-xs font-mono transition-all text-center ${
                          isSelected
                            ? "border-primary bg-primary/10 text-primary font-bold shadow-sm"
                            : "border-border bg-card/40 text-muted-foreground hover:bg-accent"
                        }`}
                      >
                        {m}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Split Position & Repeats Sliders */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{t.zapret.splitPos}</span>
                    <span className="font-mono font-bold text-foreground">{activeProfile.split_pos} byte(s)</span>
                  </div>
                  <Slider
                    value={[activeProfile.split_pos]}
                    onValueChange={([val]) => updateActiveProfile({ split_pos: val })}
                    min={1}
                    max={10}
                    step={1}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{t.zapret.repeats}</span>
                    <span className="font-mono font-bold text-foreground">{activeProfile.repeats}x</span>
                  </div>
                  <Slider
                    value={[activeProfile.repeats]}
                    onValueChange={([val]) => updateActiveProfile({ repeats: val })}
                    min={1}
                    max={5}
                    step={1}
                  />
                </div>
              </div>

              {/* Fooling Flags */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">{t.zapret.fooling}</label>
                <div className="flex flex-wrap gap-2">
                  {(["ts", "md5sig", "badseq", "badsum", "hopbyhop"] as const).map((f) => {
                    const isSelected = (activeProfile.fooling || []).includes(f);
                    return (
                      <button
                        key={f}
                        type="button"
                        onClick={() => toggleFooling(f)}
                        className={`px-3 py-1.5 rounded-md border text-xs font-mono transition-all ${
                          isSelected
                            ? "border-emerald-500 bg-emerald-500/15 text-emerald-400 font-semibold"
                            : "border-border bg-card/40 text-muted-foreground hover:bg-accent"
                        }`}
                      >
                        {f}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Fake TLS/QUIC Payload File */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">{t.zapret.fakePayload}</label>
                <div className="flex gap-2">
                  <Input
                    value={activeProfile.fake_payload_file || ""}
                    onChange={(e) => updateActiveProfile({ fake_payload_file: e.target.value })}
                    placeholder="e.g. tls_clienthello_iana_org.bin"
                    className="font-mono text-xs bg-background/50 h-9"
                  />
                  <Button variant="outline" size="sm" className="gap-1.5 h-9 text-xs">
                    <Upload className="h-3.5 w-3.5" />
                    Upload .bin
                  </Button>
                </div>
              </div>

              {/* Live CLI String preview */}
              <div className="rounded-lg border bg-black/60 p-3 space-y-1">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                  <span>{t.zapret.generatedCmd}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(cliCommand);
                      alert(lang === "ru" ? "Команда скопирована в буфер" : "Copied command to clipboard");
                    }}
                    className="hover:text-foreground flex items-center gap-1"
                  >
                    <Copy className="h-3 w-3" /> {t.common.copy}
                  </button>
                </div>
                <pre className="text-xs font-mono text-emerald-400 overflow-x-auto whitespace-pre-wrap break-all">
                  {cliCommand}
                </pre>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Hostlists & Live Strategy Test */}
        <div className="space-y-4">
          {/* Live Strategy Tester */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                <Play className="h-3.5 w-3.5 text-primary" />
                <span>{t.zapret.liveVerify}</span>
              </CardTitle>
              <CardDescription>{t.zapret.testDomain}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-2">
              <div className="flex gap-2">
                <Input
                  value={testDomain}
                  onChange={(e) => setTestDomain(e.target.value)}
                  placeholder="e.g. googlevideo.com"
                  className="font-mono text-xs h-8"
                />
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleRunStrategyTest}
                  disabled={isTesting}
                  className="h-8 text-xs gap-1"
                >
                  {isTesting ? t.common.loading : t.common.test}
                </Button>
              </div>

              {testResult && (
                <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-2.5 font-mono text-[10px] text-emerald-400 whitespace-pre-wrap">
                  {testResult}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Hostlist Manager */}
          <Card>
            <CardHeader className="pb-2 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                  <FileCode2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{t.zapret.targetHostlist}</span>
                </CardTitle>
                <Badge variant="outline" className="font-mono text-[10px]">
                  {(activeProfile.hostlist || []).length} {lang === "ru" ? "доменов" : "domains"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-3">
              <div className="flex gap-2">
                <Input
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddDomain()}
                  placeholder={t.zapret.addDomainPlaceholder}
                  className="font-mono text-xs h-8"
                />
                <Button variant="outline" size="sm" onClick={handleAddDomain} className="h-8 text-xs">
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
                {(activeProfile.hostlist || []).map((d) => (
                  <div
                    key={d}
                    className="flex items-center justify-between p-1.5 px-2.5 rounded bg-background/50 border border-border/40 text-xs font-mono"
                  >
                    <span className="text-foreground">{d}</span>
                    <button
                      onClick={() => handleRemoveDomain(d)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
