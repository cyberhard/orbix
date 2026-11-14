// ORBIX Central Error & Event State Store
// Adheres strictly to shadcn/ui Zinc design patterns and Zustand persistence
import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  NetworkEvent,
  ErrorSystemSettings,
  ErrorSeverity,
  ErrorCategory,
} from "@/types/errors";
import { eventClassifier } from "@/services/error/event-classifier";
import { eventBus } from "@/services/error/event-bus";

interface ErrorStoreState {
  events: NetworkEvent[];
  settings: ErrorSystemSettings;

  // Actions
  emitEvent: (params: {
    code?: number;
    identifier?: string;
    source: string;
    customMessage?: string;
    metadata?: Record<string, unknown>;
    correlation_id?: string;
    severityOverride?: ErrorSeverity;
  }) => NetworkEvent | null;

  acknowledgeEvent: (eventId: string) => void;
  acknowledgeAll: () => void;
  resolveEvent: (eventId: string) => void;
  clearHistory: () => void;
  updateSettings: (settings: Partial<ErrorSystemSettings>) => void;
  exportEventsJson: () => string;

  // Selectors / Helpers
  getUnreadCount: () => number;
  getActiveAlerts: () => NetworkEvent[];
  getEventsByCategory: (category: ErrorCategory) => NetworkEvent[];
  getEventsBySeverity: (severity: ErrorSeverity) => NetworkEvent[];
}

const DEFAULT_SETTINGS: ErrorSystemSettings = {
  enableNonCriticalNotifications: true,
  retentionLimit: 200,
  deduplicationIntervalMs: 15000,
  autoRecovery: true,
  killSwitchEnforcement: "strict",
  leakProtection: true,
  logLevel: "info",
};

export const useErrorStore = create<ErrorStoreState>()(
  persist(
    (set, get) => {
      // Connect eventBus listener to keep store updated
      eventBus.subscribe((incomingEvent) => {
        const state = get();
        // Check if non-critical events are muted
        if (
          !state.settings.enableNonCriticalNotifications &&
          (incomingEvent.severity === "info" || incomingEvent.severity === "warning")
        ) {
          // Still store in history, but mark acknowledged
          incomingEvent.acknowledged = true;
        }

        const existingIdx = state.events.findIndex((e) => e.event_id === incomingEvent.event_id);
        let updatedList: NetworkEvent[];

        if (existingIdx >= 0) {
          updatedList = [...state.events];
          updatedList[existingIdx] = incomingEvent;
        } else {
          updatedList = [incomingEvent, ...state.events].slice(0, state.settings.retentionLimit);
        }

        set({ events: updatedList });
      });

      return {
        events: [],
        settings: DEFAULT_SETTINGS,

        emitEvent: (params) => {
          return eventClassifier.processEvent({
            ...params,
            deduplicationIntervalMs: get().settings.deduplicationIntervalMs,
          });
        },

        acknowledgeEvent: (eventId) => {
          set((state) => ({
            events: state.events.map((e) =>
              e.event_id === eventId ? { ...e, acknowledged: true } : e
            ),
          }));
        },

        acknowledgeAll: () => {
          set((state) => ({
            events: state.events.map((e) => ({ ...e, acknowledged: true })),
          }));
        },

        resolveEvent: (eventId) => {
          set((state) => ({
            events: state.events.map((e) =>
              e.event_id === eventId
                ? { ...e, status: "resolved", resolvedAt: Date.now() }
                : e
            ),
          }));
        },

        clearHistory: () => {
          // Retain unresolved critical alerts, clear acknowledged resolved ones
          set((state) => ({
            events: state.events.filter(
              (e) => e.status === "active" && e.severity === "critical"
            ),
          }));
        },

        updateSettings: (partial) => {
          set((state) => ({
            settings: { ...state.settings, ...partial },
          }));
        },

        exportEventsJson: () => {
          return JSON.stringify(
            {
              exportedAt: new Date().toISOString(),
              totalEvents: get().events.length,
              settings: get().settings,
              events: get().events,
            },
            null,
            2
          );
        },

        getUnreadCount: () => {
          return get().events.filter((e) => !e.acknowledged && e.status === "active").length;
        },

        getActiveAlerts: () => {
          return get().events.filter((e) => e.status === "active");
        },

        getEventsByCategory: (category) => {
          return get().events.filter((e) => e.category === category);
        },

        getEventsBySeverity: (severity) => {
          return get().events.filter((e) => e.severity === severity);
        },
      };
    },
    {
      name: "orbix_error_events_storage_v1",
      partialize: (state) => ({
        events: state.events.slice(0, 100),
        settings: state.settings,
      }),
    }
  )
);
