// Default curated Network Policies for OpenWrt Policy Engine
import { NetworkPolicy } from "./types";

export const DEFAULT_NETWORK_POLICIES: NetworkPolicy[] = [
  {
    id: "sys-policy-banking-direct",
    name: "Банки и платёжные шлюзы (Строго WAN)",
    description: "Сбербанк, Т-Банк, ВТБ, Госуслуги подключаются строго напрямую через WAN провайдера",
    enabled: true,
    priority: 5,
    isSystem: true,
    mode: "simple",
    source: {
      type: "all",
      values: [],
    },
    destination: {
      type: "category",
      values: ["category:banking"],
    },
    action: {
      type: "direct_wan",
      target: "wan",
    },
  },
  {
    id: "sys-policy-russia-direct",
    name: "Российские сервисы и Рунет (.RU)",
    description: "Отечественные ресурсы, VK, Яндекс, Ozon, WB, зоны .ru и .рф направляются напрямую без расхода трафика VPN",
    enabled: true,
    priority: 10,
    isSystem: true,
    mode: "simple",
    source: {
      type: "all",
      values: [],
    },
    destination: {
      type: "category",
      values: ["category:russia"],
    },
    action: {
      type: "direct_wan",
      target: "wan",
    },
  },
  {
    id: "sys-policy-youtube-zapret",
    name: "YouTube и видеопотоки (Zapret DPI Desync)",
    description: "Обход замедления ТСПУ для видеосерверов googlevideo.com через hostfakesplit без туннелирования",
    enabled: true,
    priority: 20,
    isSystem: true,
    mode: "simple",
    source: {
      type: "all",
      values: [],
    },
    destination: {
      type: "category",
      values: ["category:youtube"],
    },
    action: {
      type: "zapret_dpi",
      target: "profile:hostfakesplit",
      fallbackAction: "direct_wan",
    },
  },
  {
    id: "sys-policy-discord-zapret",
    name: "Discord и голосовые шлюзы (Туннель VLESS Reality)",
    description: "Надёжный обход блокировок ТСПУ для discord.com и голосовых каналов WebRTC discord.media через зарубежный туннель",
    enabled: true,
    priority: 25,
    isSystem: true,
    mode: "simple",
    source: {
      type: "all",
      values: [],
    },
    destination: {
      type: "category",
      values: ["category:discord"],
    },
    action: {
      type: "vpn_tunnel",
      target: "singbox",
      fallbackAction: "direct_wan",
    },
  },
  {
    id: "sys-policy-ai-smartdns",
    name: "Нейросети и AI (Smart DNS dns-ai.ru / VLESS)",
    description: "ChatGPT, Claude, Gemini, Perplexity через обратный прокси dns-ai.ru или VLESS без расхода трафика",
    enabled: true,
    priority: 30,
    isSystem: true,
    mode: "simple",
    source: {
      type: "all",
      values: [],
    },
    destination: {
      type: "category",
      values: ["category:ai_services"],
    },
    action: {
      type: "vpn_tunnel",
      target: "singbox",
      fallbackAction: "direct_wan",
    },
  },
  {
    id: "sys-policy-geoblocked-vpn",
    name: "Зарубежные сервисы и гео-блокировки (VLESS Reality)",
    description: "Instagram, Twitter/X, Netflix, Canva, Tor через зарубежный туннель Sing-box VLESS Reality",
    enabled: true,
    priority: 40,
    isSystem: true,
    mode: "simple",
    source: {
      type: "all",
      values: [],
    },
    destination: {
      type: "category",
      values: ["category:restricted"],
    },
    action: {
      type: "vpn_tunnel",
      target: "singbox",
      fallbackAction: "direct_wan",
    },
  },
  {
    id: "sys-policy-default-wan",
    name: "Основной шлюз интернета по умолчанию (Direct WAN)",
    description: "Любой трафик, не подпадающий под специальные правила, уходит напрямую через провайдера",
    enabled: true,
    priority: 999,
    isSystem: true,
    mode: "simple",
    source: {
      type: "all",
      values: [],
    },
    destination: {
      type: "all",
      values: [],
    },
    action: {
      type: "default",
      target: "wan",
    },
  },
];
