// ORBIX Central Event Bus
// Decoupled pub/sub for network, security, and system lifecycle events
import { NetworkEvent, ErrorCategory, ErrorSeverity } from "@/types/errors";

export type EventSubscriber = (event: NetworkEvent) => void;

class EventBus {
  private subscribers: Set<EventSubscriber> = new Set();
  private categorySubscribers: Map<ErrorCategory, Set<EventSubscriber>> = new Map();
  private severitySubscribers: Map<ErrorSeverity, Set<EventSubscriber>> = new Map();

  public subscribe(callback: EventSubscriber): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  public subscribeToCategory(category: ErrorCategory, callback: EventSubscriber): () => void {
    if (!this.categorySubscribers.has(category)) {
      this.categorySubscribers.set(category, new Set());
    }
    const set = this.categorySubscribers.get(category)!;
    set.add(callback);

    return () => {
      set.delete(callback);
    };
  }

  public subscribeToSeverity(severity: ErrorSeverity, callback: EventSubscriber): () => void {
    if (!this.severitySubscribers.has(severity)) {
      this.severitySubscribers.set(severity, new Set());
    }
    const set = this.severitySubscribers.get(severity)!;
    set.add(callback);

    return () => {
      set.delete(callback);
    };
  }

  public publish(event: NetworkEvent): void {
    // Notify all global subscribers
    this.subscribers.forEach((cb) => {
      try {
        cb(event);
      } catch (err) {
        console.error("[EventBus] Subscriber error:", err);
      }
    });

    // Notify category-specific subscribers
    const catSet = this.categorySubscribers.get(event.category);
    if (catSet) {
      catSet.forEach((cb) => {
        try {
          cb(event);
        } catch (err) {
          console.error("[EventBus] Category subscriber error:", err);
        }
      });
    }

    // Notify severity-specific subscribers
    const sevSet = this.severitySubscribers.get(event.severity);
    if (sevSet) {
      sevSet.forEach((cb) => {
        try {
          cb(event);
        } catch (err) {
          console.error("[EventBus] Severity subscriber error:", err);
        }
      });
    }
  }
}

export const eventBus = new EventBus();
