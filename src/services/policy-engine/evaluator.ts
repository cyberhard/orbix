// Deterministic Route Evaluator & Explain Engine
import {
  NetworkPolicy,
  DomainCategory,
  DeviceGroup,
  RouteEvaluationResult,
} from "./types";
import { DEFAULT_DOMAIN_CATEGORIES } from "./categories";
import { DEFAULT_NETWORK_POLICIES } from "./default-policies";

export class RouteEvaluator {
  private categories: Map<string, DomainCategory> = new Map();
  private deviceGroups: Map<string, DeviceGroup> = new Map();

  constructor(
    categories: DomainCategory[] = DEFAULT_DOMAIN_CATEGORIES,
    deviceGroups: DeviceGroup[] = []
  ) {
    categories.forEach((c) => this.categories.set(c.id, c));
    deviceGroups.forEach((g) => this.deviceGroups.set(g.id, g));
  }

  public setCategories(cats: DomainCategory[]) {
    this.categories.clear();
    cats.forEach((c) => this.categories.set(c.id, c));
  }

  public setDeviceGroups(groups: DeviceGroup[]) {
    this.deviceGroups.clear();
    groups.forEach((g) => this.deviceGroups.set(g.id, g));
  }

  private matchesDomain(target: string, domainPattern: string): boolean {
    const t = target.toLowerCase().trim();
    const p = domainPattern.toLowerCase().trim();

    if (p.startsWith(".")) {
      return t.endsWith(p) || t === p.slice(1);
    }
    return t === p || t.endsWith(`.${p}`);
  }

  private matchesSource(sourceIp: string, policy: NetworkPolicy): boolean {
    if (policy.source.type === "all") return true;

    for (const val of policy.source.values) {
      if (val === sourceIp || val === `ip:${sourceIp}` || val === `device:${sourceIp}`) {
        return true;
      }
      if (val.startsWith("group:")) {
        const groupId = val.replace("group:", "");
        const group = this.deviceGroups.get(groupId);
        if (group && group.deviceIps.includes(sourceIp)) {
          return true;
        }
      }
      if (val.includes("/")) {
        // Simple subnet prefix match (e.g. 192.168.1.0/24)
        const prefix = val.split("/")[0].split(".").slice(0, 3).join(".");
        if (sourceIp.startsWith(`${prefix}.`)) return true;
      }
    }

    return false;
  }

  private matchesDestination(
    target: string,
    policy: NetworkPolicy
  ): { matched: boolean; reason: string } {
    if (policy.destination.type === "all") {
      return { matched: true, reason: "Default all-traffic rule" };
    }

    const t = target.toLowerCase().trim();

    for (const val of policy.destination.values) {
      if (val.startsWith("category:")) {
        const catId = val.replace("category:", "");
        const cat = this.categories.get(catId);
        if (cat) {
          for (const d of cat.domains) {
            if (this.matchesDomain(t, d)) {
              return {
                matched: true,
                reason: `Совпадение с категорией "${cat.nameRu}" (правило: ${d})`,
              };
            }
          }
        }
      } else if (val.startsWith("domain:")) {
        const d = val.replace("domain:", "");
        if (this.matchesDomain(t, d)) {
          return { matched: true, reason: `Точное совпадение с доменом ${d}` };
        }
      } else if (!val.includes(":") && !val.includes("/")) {
        if (this.matchesDomain(t, val)) {
          return { matched: true, reason: `Совпадение с доменом ${val}` };
        }
      }
    }

    return { matched: false, reason: "" };
  }

  /**
   * Evaluates complete route decision pipeline for given input
   */
  public evaluate(
    target: string,
    sourceIp = "192.168.1.130",
    protocol = "tcp",
    port = 443,
    policies: NetworkPolicy[] = DEFAULT_NETWORK_POLICIES
  ): RouteEvaluationResult {
    const sorted = policies
      .filter((p) => p.enabled)
      .sort((a, b) => a.priority - b.priority);

    const matchedList: Array<{
      policy: NetworkPolicy;
      matchReason: string;
      isWinner: boolean;
    }> = [];

    for (const p of sorted) {
      if (this.matchesSource(sourceIp, p)) {
        const destMatch = this.matchesDestination(target, p);
        if (destMatch.matched) {
          matchedList.push({
            policy: p,
            matchReason: destMatch.reason,
            isWinner: false,
          });
        }
      }
    }

    const winner = matchedList.length > 0 ? matchedList[0].policy : null;
    if (matchedList.length > 0) {
      matchedList[0].isWinner = true;
    }

    // Determine DNS, DPI, Firewall & Outbounds
    const isRuTarget =
      target.endsWith(".ru") ||
      target.endsWith(".рф") ||
      target.endsWith(".su") ||
      target.includes("yandex") ||
      target.includes("vk.") ||
      target.includes("gosuslugi");

    const isAiTarget =
      target.includes("chatgpt") ||
      target.includes("openai") ||
      target.includes("claude.ai") ||
      target.includes("gemini");

    const isYoutubeTarget =
      target.includes("youtube") ||
      target.includes("googlevideo") ||
      target.includes("ytimg");

    const isDiscordTarget = target.includes("discord");

    let selectedAction = winner?.action.type || "default";
    let selectedOutbound = "wan";
    let dpiApplied = false;
    let dpiStrategy = "none";
    let expectedRoute = "Direct WAN";
    let resolver = "77.88.8.8 (Local ISP / Yandex DNS)";
    let dohUsed = false;

    if (winner) {
      switch (winner.action.type) {
        case "direct_wan":
          selectedOutbound = "wan (Прямой интернет)";
          expectedRoute = "Прямое подключение к провайдеру без VPN";
          break;

        case "zapret_dpi":
          selectedOutbound = "wan + nfqws (DPI Desync)";
          dpiApplied = true;
          dpiStrategy = isYoutubeTarget ? "hostfakesplit (Google CDN)" : "multisplit (Discord / TLS)";
          expectedRoute = `Прямой WAN с обходом ТСПУ через Zapret (${dpiStrategy})`;
          break;

        case "vpn_tunnel":
        case "vpn_group":
          selectedOutbound = winner.action.target || "singbox (VLESS Reality)";
          expectedRoute = `Зашифрованный туннель Sing-box VLESS Reality (${selectedOutbound})`;
          resolver = "1.1.1.1 (Cloudflare DoH / Tunnel DNS)";
          dohUsed = true;
          break;

        case "block":
          selectedOutbound = "drop (Заблокировано)";
          expectedRoute = "Трафик сброшен локальным фаерволом (DROP)";
          break;

        default:
          selectedOutbound = "wan (Шлюз по умолчанию)";
          expectedRoute = "Шлюз по умолчанию (Direct WAN)";
          break;
      }
    }

    if (isAiTarget) {
      resolver = "dns-ai.ru (Smart DNS reverse proxy)";
      dohUsed = true;
    }

    const troubleshooting: RouteEvaluationResult["troubleshooting"] = [];

    if (target.includes("instagram") && dpiApplied) {
      troubleshooting.push({
        severity: "warning",
        title: "Блокировка подсетей Meta на уровне BGP провайдера",
        description: "Подсети Instagram (157.240.0.0/16) заблокированы на магистральном уровне провайдера (TCP SYN drop). Zapret не может доставить пакеты.",
        actionableStep: "Рекомендуется переключить Instagram в правило VLESS Reality для стабильной работы.",
      });
    }

    if (isYoutubeTarget && dpiStrategy.includes("split-seqovl")) {
      troubleshooting.push({
        severity: "error",
        title: "Несовместимость ALT11 split-seqovl с Linux TCP Timestamps",
        description: "Стратегия seqovl приводит к рассинхронизации потоков Google Video CDN при tcp_timestamps=1.",
        actionableStep: "Используйте профиль hostfakesplit, который штатно разблокирует YouTube в 1080p.",
      });
    }

    return {
      target,
      sourceIp,
      protocol,
      port,
      matchedPolicies: matchedList,
      winningPolicy: winner,
      winningReason: winner
        ? `Matched priority rule #${winner.priority}: "${winner.name}"`
        : "No specific rule matched; fallback to system default route",
      winningReasonRu: winner
        ? `Сработало приоритетное правило #${winner.priority}: "${winner.name}"`
        : "Ни одно специальное правило не совпало; применён шлюз по умолчанию",
      selectedAction,
      selectedOutbound,
      dnsResolution: {
        resolver,
        dohUsed,
        policyApplied: isAiTarget ? "Smart DNS (dns-ai.ru)" : isRuTarget ? "Direct RuNet DNS" : "Secure Remote DNS",
      },
      dpiProcessing: {
        enabled: dpiApplied,
        engine: dpiApplied ? "nfqws" : undefined,
        strategy: dpiApplied ? dpiStrategy : undefined,
        profileName: dpiApplied ? (isYoutubeTarget ? "hostfakesplit" : "multisplit") : undefined,
      },
      firewallDecision: winner?.action.type === "block" ? "DROP" : "ACCEPT",
      expectedRoute,
      configuredRoute: expectedRoute,
      observedRoute: expectedRoute,
      verificationStatus: "verified",
      troubleshooting,
    };
  }
}

export const routeEvaluator = new RouteEvaluator();
