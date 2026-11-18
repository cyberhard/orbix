// Built-in presets: real launch scripts from Flowseal/zapret-discord-youtube (winws.exe).
// Raw .bat files ship alongside and go through the same parser as user uploads.
import generalBat from "./presets/flowseal-general.bat?raw";
import fakeTlsAutoBat from "./presets/flowseal-general-fake-tls-auto.bat?raw";
import simpleFakeBat from "./presets/flowseal-general-simple-fake.bat?raw";

export interface ZapretPreset {
  id: string;
  label: string;
  description: string;
  bat: string;
}

export const FLOWSEAL_PRESETS: ZapretPreset[] = [
  {
    id: "general",
    label: "general (Flowseal)",
    description:
      "Полный профиль из zapret-discord-youtube: QUIC-фейк, Discord STUN, multisplit по TLS, google через ip-id",
    bat: generalBat,
  },
  {
    id: "fake-tls-auto",
    label: "FAKE TLS AUTO",
    description: "Автоматический фейк TLS-пакета + фрагментация, вариант для жёсткого DPI",
    bat: fakeTlsAutoBat,
  },
  {
    id: "simple-fake",
    label: "SIMPLE FAKE",
    description: "Простой fake-пакет без сложных сплитов — мягкий старт",
    bat: simpleFakeBat,
  },
];
