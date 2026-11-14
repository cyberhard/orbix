// ORBIX Event Classifier & Rate Limiter
// Prevents notification flooding, correlates related alerts, and deduplicates identical events
import { NetworkEvent, ErrorDefinition, ErrorSeverity } from "@/types/errors";
import { getErrorByCode, getErrorByIdentifier } from "./error-registry";
import { eventBus } from "./event-bus";

interface DeduplicationEntry {
  event: NetworkEvent;
  lastEmitted: number;
  count: number;
}

export class EventClassifier {
  private recentEvents: Map<string, DeduplicationEntry> = new Map();
  private maxRatePerMinute = 60;
  private minuteBuckets: number[] = [];

  /**
   * Classify and process an incoming event.
   * If an identical event was emitted within deduplicationIntervalMs, updates the repeat count instead of emitting a new duplicate.
   */
  public processEvent(params: {
    code?: number;
    identifier?: string;
    source: string;
    customMessage?: string;
    metadata?: Record<string, unknown>;
    correlation_id?: string;
    severityOverride?: ErrorSeverity;
    deduplicationIntervalMs?: number;
  }): NetworkEvent | null {
    const interval = params.deduplicationIntervalMs ?? 15000;
    const now = Date.now();

    // 1. Rate Limiting Check
    this.cleanMinuteBuckets(now);
    if (this.minuteBuckets.length >= this.maxRatePerMinute) {
      console.warn("[EventClassifier] Global rate limit exceeded, suppressing event:", params);
      return null;
    }

    // 2. Resolve Error Definition
    let def: ErrorDefinition;
    if (params.code !== undefined) {
      def = getErrorByCode(params.code);
    } else if (params.identifier) {
      const found = getErrorByIdentifier(params.identifier);
      def = found || getErrorByCode(904);
    } else {
      def = getErrorByCode(904);
    }

    const dedupKey = `${def.code}:${params.source}`;
    const existing = this.recentEvents.get(dedupKey);

    // 3. Deduplication Check
    if (existing && now - existing.lastEmitted < interval) {
      existing.count += 1;
      existing.lastEmitted = now;
      existing.event.repeatCount = existing.count;
      existing.event.timestamp = now;
      if (params.metadata) {
        existing.event.metadata = { ...existing.event.metadata, ...params.metadata };
      }
      return existing.event;
    }

    // 4. Construct Fresh Event
    const eventId = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const event: NetworkEvent = {
      event_id: eventId,
      code: def.code,
      identifier: def.identifier,
      severity: params.severityOverride || def.severity,
      category: def.category,
      source: params.source,
      message: params.customMessage || def.title.ru,
      timestamp: now,
      status: "active",
      metadata: params.metadata,
      correlation_id: params.correlation_id,
      acknowledged: false,
      repeatCount: 1,
    };

    // Store in deduplication cache
    this.recentEvents.set(dedupKey, {
      event,
      lastEmitted: now,
      count: 1,
    });

    // Record rate limit tick
    this.minuteBuckets.push(now);

    // 5. Emit to Central Event Bus
    eventBus.publish(event);

    return event;
  }

  private cleanMinuteBuckets(now: number): void {
    const oneMinAgo = now - 60000;
    this.minuteBuckets = this.minuteBuckets.filter((t) => t > oneMinAgo);
  }

  public clearDeduplicationCache(): void {
    this.recentEvents.clear();
  }
}

export const eventClassifier = new EventClassifier();
