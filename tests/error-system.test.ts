import { describe, it, expect, beforeEach } from "vitest";
import {
  getErrorByCode,
  getErrorByIdentifier,
  getErrorsByCategory,
  getErrorsBySeverity,
} from "../src/services/error/error-registry";
import { eventClassifier } from "../src/services/error/event-classifier";
import { useErrorStore } from "../src/store/error-store";

describe("ORBIX Error Code Registry", () => {
  it("resolves standard error codes correctly across all 9 ranges", () => {
    // 100 System
    const e100 = getErrorByCode(100);
    expect(e100.identifier).toBe("SYSTEM_INITIALIZATION_FAILED");
    expect(e100.category).toBe("system");
    expect(e100.severity).toBe("critical");

    // 200 Network
    const e203 = getErrorByCode(203);
    expect(e203.identifier).toBe("WAN_UNAVAILABLE");
    expect(e203.category).toBe("network");

    // 300 Routing
    const e301 = getErrorByCode(301);
    expect(e301.identifier).toBe("NO_VALID_ROUTE");
    expect(e301.category).toBe("routing");

    // 400 Security
    const e410 = getErrorByCode(410);
    expect(e410.identifier).toBe("KILL_SWITCH_TRIGGERED");
    expect(e410.category).toBe("security");
    expect(e410.severity).toBe("critical");

    // 500 VPN
    const e501 = getErrorByCode(501);
    expect(e501.identifier).toBe("VPN_DISCONNECTED");
    expect(e501.category).toBe("vpn");

    // 600 DNS
    const e606 = getErrorByCode(606);
    expect(e606.identifier).toBe("DNS_REBINDING_BLOCKED");
    expect(e606.category).toBe("dns");

    // 700 Config
    const e702 = getErrorByCode(702);
    expect(e702.identifier).toBe("CONFIGURATION_APPLY_FAILED");
    expect(e702.category).toBe("config");

    // 800 Hardware
    const e802 = getErrorByCode(802);
    expect(e802.identifier).toBe("CAPABILITY_MISSING");
    expect(e802.category).toBe("hardware");

    // 900 Services
    const e901 = getErrorByCode(901);
    expect(e901.identifier).toBe("SERVICE_CRASHED");
    expect(e901.category).toBe("services");
  });

  it("handles unknown error codes with safe fallback", () => {
    const unknown = getErrorByCode(9999);
    expect(unknown.code).toBe(9999);
    expect(unknown.identifier).toBe("UNKNOWN_ERROR_9999");
    expect(unknown.category).toBe("services");
    expect(unknown.title.ru).toBeDefined();
    expect(unknown.title.en).toBeDefined();
    expect(unknown.remediation.ru.length).toBeGreaterThan(0);
  });

  it("filters errors by category and severity", () => {
    const vpnErrors = getErrorsByCategory("vpn");
    expect(vpnErrors.length).toBeGreaterThan(0);
    expect(vpnErrors.every((e) => e.category === "vpn")).toBe(true);

    const criticalErrors = getErrorsBySeverity("critical");
    expect(criticalErrors.length).toBeGreaterThan(0);
    expect(criticalErrors.every((e) => e.severity === "critical")).toBe(true);
  });
});

describe("ORBIX Event Classifier & Rate Limiting", () => {
  beforeEach(() => {
    eventClassifier.clearDeduplicationCache();
  });

  it("deduplicates identical events within time window", () => {
    const ev1 = eventClassifier.processEvent({
      code: 201,
      source: "wan_monitor",
      deduplicationIntervalMs: 10000,
    });
    expect(ev1).not.toBeNull();
    expect(ev1?.repeatCount).toBe(1);

    // Immediate second event with same signature
    const ev2 = eventClassifier.processEvent({
      code: 201,
      source: "wan_monitor",
      deduplicationIntervalMs: 10000,
    });
    expect(ev2).not.toBeNull();
    expect(ev2?.repeatCount).toBe(2);
    expect(ev2?.event_id).toBe(ev1?.event_id);
  });

  it("differentiates events with different error codes or sources", () => {
    const evA = eventClassifier.processEvent({
      code: 201,
      source: "wan_monitor",
    });
    const evB = eventClassifier.processEvent({
      code: 410,
      source: "kill_switch",
    });
    expect(evA?.event_id).not.toBe(evB?.event_id);
    expect(evA?.code).toBe(201);
    expect(evB?.code).toBe(410);
  });
});

describe("ORBIX Error Store", () => {
  beforeEach(() => {
    useErrorStore.setState({ events: [] });
    eventClassifier.clearDeduplicationCache();
  });

  it("emits, acknowledges and resolves events correctly", () => {
    const store = useErrorStore.getState();

    // 1. Emit
    const ev = store.emitEvent({
      code: 410,
      source: "test_suite",
      customMessage: "Kill Switch Test Trigger",
    });
    expect(ev).not.toBeNull();
    expect(useErrorStore.getState().getUnreadCount()).toBe(1);
    expect(useErrorStore.getState().getActiveAlerts().length).toBe(1);

    // 2. Acknowledge
    if (ev) {
      store.acknowledgeEvent(ev.event_id);
      expect(useErrorStore.getState().getUnreadCount()).toBe(0);
      expect(useErrorStore.getState().getActiveAlerts().length).toBe(1); // Still active until resolved

      // 3. Resolve
      store.resolveEvent(ev.event_id);
      expect(useErrorStore.getState().getActiveAlerts().length).toBe(0);
    }
  });

  it("exports event log history to JSON correctly", () => {
    const store = useErrorStore.getState();
    store.emitEvent({
      code: 606,
      source: "dns_guard",
    });

    const json = store.exportEventsJson();
    expect(typeof json).toBe("string");
    const parsed = JSON.parse(json);
    expect(parsed.events).toBeDefined();
    expect(parsed.events.length).toBe(1);
    expect(parsed.events[0].code).toBe(606);
    expect(parsed.events[0].identifier).toBe("DNS_REBINDING_BLOCKED");
  });
});
