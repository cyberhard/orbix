// Conflict Detector for OpenWrt Policy Engine
import { NetworkPolicy, PolicyConflict } from "./types";

export class PolicyConflictDetector {
  public detectConflicts(policies: NetworkPolicy[]): PolicyConflict[] {
    const conflicts: PolicyConflict[] = [];
    const active = policies.filter((p) => p.enabled);

    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const pA = active[i];
        const pB = active[j];

        // Ensure p1 has higher or equal priority (lower number)
        const [higher, lower] = pA.priority <= pB.priority ? [pA, pB] : [pB, pA];

        // 1. Check for Complete Shadowing (e.g. higher priority rule covers ALL destinations and sources)
        if (
          higher.destination.type === "all" &&
          higher.source.type === "all" &&
          higher.priority < lower.priority &&
          lower.priority < 990 // ignore default system fallback
        ) {
          conflicts.push({
            id: `shadow-${higher.id}-${lower.id}`,
            policyA: { id: higher.id, name: higher.name, priority: higher.priority },
            policyB: { id: lower.id, name: lower.name, priority: lower.priority },
            type: "shadow",
            severity: "error",
            message: `Rule "${higher.name}" completely shadows "${lower.name}".`,
            messageRu: `Правило "${higher.name}" перехватывает весь трафик и полностью блокирует выполнение "${lower.name}".`,
            recommendation: `Increase the priority of "${lower.name}" or restrict the destinations in "${higher.name}".`,
            recommendationRu: `Увеличьте приоритет правила "${lower.name}" (сделайте номер меньше ${higher.priority}) или сузьте цели в "${higher.name}".`,
          });
          continue;
        }

        // 2. Check for Overlapping destinations with Contradictory actions
        const commonDests = this.findCommonDestinations(
          higher.destination.values,
          lower.destination.values
        );

        if (commonDests.length > 0 && higher.action.type !== lower.action.type) {
          conflicts.push({
            id: `overlap-${higher.id}-${lower.id}`,
            policyA: { id: higher.id, name: higher.name, priority: higher.priority },
            policyB: { id: lower.id, name: lower.name, priority: lower.priority },
            type: "contradiction",
            severity: "warning",
            message: `Conflicting actions for "${commonDests.join(", ")}": "${higher.name}" sends to ${higher.action.type}, while "${lower.name}" specifies ${lower.action.type}.`,
            messageRu: `Конфликт действий для [${commonDests.join(", ")}]: правило "${higher.name}" направляет в ${higher.action.type}, а "${lower.name}" — в ${lower.action.type}. Побеждает "${higher.name}" (приоритет ${higher.priority}).`,
            recommendation: `Remove the duplicate category/domain or adjust priorities.`,
            recommendationRu: `Удалите дублирующиеся домены из одного из правил или проверьте порядок приоритетов.`,
          });
        }
      }
    }

    return conflicts;
  }

  private findCommonDestinations(valsA: string[], valsB: string[]): string[] {
    const setA = new Set(valsA.map((v) => v.toLowerCase().trim()));
    const common: string[] = [];

    for (const b of valsB) {
      const bNorm = b.toLowerCase().trim();
      if (setA.has(bNorm)) {
        common.push(bNorm);
      }
    }

    return common;
  }
}

export const conflictDetector = new PolicyConflictDetector();
