// ORBIX • Hash-query tab state
// Syncs in-page tabs with the URL hash query (`#/policies?tab=lists`) so that
// legacy redirects like `/lists -> /policies?tab=lists` deep-link into a tab.
import { useState, useEffect, useCallback } from "react";

export function parseHashRoute(hash: string): { base: string; query: URLSearchParams } {
  let raw = hash.replace(/^#\/?/, "").toLowerCase().trim();
  const [pathPart, queryPart] = raw.split("?");
  const base = pathPart.split("/").filter(Boolean).join("/") || "overview";
  return { base, query: new URLSearchParams(queryPart || "") };
}

export function readHashTab(fallback = ""): string {
  if (typeof window === "undefined") return fallback;
  const { query } = parseHashRoute(window.location.hash);
  return query.get("tab") || fallback;
}

export function writeHashTab(base: string, tab: string) {
  if (typeof window === "undefined") return;
  const target = `#/${base}?tab=${tab}`;
  if (window.location.hash !== target) {
    // replaceState keeps the back-stack clean while switching tabs
    window.history.replaceState(null, "", target);
  }
}

/** Current tab value driven by `#/route?tab=x`, kept in sync on hashchange. */
export function useHashTab(base: string, defaultTab: string, allowed: string[]) {
  const clamp = useCallback(
    (t: string) => (allowed.includes(t) ? t : defaultTab),
    [defaultTab, allowed]
  );
  const [tab, setTabState] = useState<string>(() => clamp(readHashTab(defaultTab)));

  useEffect(() => {
    const sync = () => setTabState(clamp(readHashTab(defaultTab)));
    window.addEventListener("hashchange", sync);
    sync();
    return () => window.removeEventListener("hashchange", sync);
  }, [clamp, defaultTab]);

  const setTab = useCallback(
    (t: string) => {
      setTabState(t);
      writeHashTab(base, t);
    },
    [base]
  );

  return [tab, setTab] as const;
}
