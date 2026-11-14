import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

export function formatBits(bits: number, decimals = 2): string {
  if (bits === 0) return "0 bps";
  const k = 1000;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["bps", "Kbps", "Mbps", "Gbps"];
  const i = Math.floor(Math.log(bits) / Math.log(k));
  return parseFloat((bits / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

export function formatUptime(seconds: number, lang: "ru" | "en" = "en"): string {
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts = [];
  if (lang === "ru") {
    if (d > 0) parts.push(`${d}д`);
    if (h > 0) parts.push(`${h}ч`);
    if (m > 0) parts.push(`${m}м`);
    parts.push(`${s}с`);
  } else {
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    parts.push(`${s}s`);
  }
  return parts.join(" ");
}

/**
 * Natural Russian pluralization:
 * pluralizeRu(1, 'устройство', 'устройства', 'устройств') => "1 устройство"
 * pluralizeRu(4, 'устройство', 'устройства', 'устройств') => "4 устройства"
 * pluralizeRu(5, 'устройство', 'устройства', 'устройств') => "5 устройств"
 */
export function pluralizeRu(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n) % 100;
  const rem = abs % 10;
  if (abs > 10 && abs < 20) return `${n} ${many}`;
  if (rem > 1 && rem < 5) return `${n} ${few}`;
  if (rem === 1) return `${n} ${one}`;
  return `${n} ${many}`;
}

export function pluralizeEn(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}
