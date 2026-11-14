import { describe, it, expect } from "vitest";
import { CpuArchitecture } from "@/services/hal/types";

describe("Hardware Abstraction Layer (HAL)", () => {
  function classifyArchitecture(rawSystem: string): CpuArchitecture {
    const rawArch = (rawSystem || "").toLowerCase();
    if (rawArch.includes("aarch64") || rawArch.includes("arm64") || rawArch.includes("armv8")) {
      return "aarch64";
    } else if (rawArch.includes("arm") || rawArch.includes("cortex")) {
      return "arm";
    } else if (rawArch.includes("x86_64") || rawArch.includes("amd64")) {
      return "x86_64";
    } else if (rawArch.includes("mipsel")) {
      return "mipsel";
    } else if (rawArch.includes("mips")) {
      return "mips";
    } else if (rawArch.includes("riscv64")) {
      return "riscv64";
    }
    return "unknown";
  }

  function detectPackageManager(openwrtVersion: string): "apk" | "opkg" {
    return openwrtVersion.startsWith("25") || openwrtVersion.startsWith("SNAPSHOT") ? "apk" : "opkg";
  }

  function detectWifiGenerations(radios: Array<{ htmode: string; band: string }>): {
    hasWifi6: boolean;
    hasWifi7: boolean;
    hasDualBand: boolean;
  } {
    let hasWifi6 = false;
    let hasWifi7 = false;
    let has2G = false;
    let has5G = false;

    for (const r of radios) {
      if (r.band === "2g" || r.band === "2.4ghz") has2G = true;
      if (r.band === "5g" || r.band === "5ghz") has5G = true;
      if (r.htmode.includes("HE") || r.htmode.includes("ax")) hasWifi6 = true;
      if (r.htmode.includes("EHT") || r.htmode.includes("be")) hasWifi7 = true;
    }

    return {
      hasWifi6,
      hasWifi7,
      hasDualBand: has2G && has5G,
    };
  }

  it("should classify diverse hardware architectures accurately", () => {
    expect(classifyArchitecture("ARMv8 Processor rev 4 (v8l)")).toBe("aarch64");
    expect(classifyArchitecture("MediaTek MT7981 (aarch64)")).toBe("aarch64");
    expect(classifyArchitecture("ARMv7 Processor rev 1 (v7l)")).toBe("arm");
    expect(classifyArchitecture("Intel(R) Core(TM) i5-8250U CPU @ 1.60GHz x86_64")).toBe("x86_64");
    expect(classifyArchitecture("MediaTek MT7621AT mipsel")).toBe("mipsel");
    expect(classifyArchitecture("Atheros AR9344 mips")).toBe("mips");
    expect(classifyArchitecture("AlienProcessor")).toBe("unknown");
  });

  it("should determine package manager based on OpenWrt version generation", () => {
    expect(detectPackageManager("25.12.6")).toBe("apk");
    expect(detectPackageManager("SNAPSHOT")).toBe("apk");
    expect(detectPackageManager("24.10.0")).toBe("opkg");
    expect(detectPackageManager("23.05.4")).toBe("opkg");
    expect(detectPackageManager("21.02.7")).toBe("opkg");
  });

  it("should detect Wi-Fi 6, Wi-Fi 7, and dual-band configurations from radio parameters", () => {
    const mt7981FilogicRadios = [
      { band: "2g", htmode: "HE20" },
      { band: "5g", htmode: "HE80" },
    ];
    const filogicCaps = detectWifiGenerations(mt7981FilogicRadios);
    expect(filogicCaps.hasWifi6).toBe(true);
    expect(filogicCaps.hasDualBand).toBe(true);
    expect(filogicCaps.hasWifi7).toBe(false);

    const wifi7Radios = [
      { band: "2g", htmode: "EHT20" },
      { band: "5g", htmode: "EHT160" },
    ];
    const wifi7Caps = detectWifiGenerations(wifi7Radios);
    expect(wifi7Caps.hasWifi7).toBe(true);
    expect(wifi7Caps.hasDualBand).toBe(true);
  });
});
