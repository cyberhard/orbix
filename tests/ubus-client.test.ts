import { describe, it, expect, vi, beforeEach } from "vitest";
import { ubusClient } from "@/lib/ubus-client";

describe("UbusClient Robustness & Security", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should provide getSystemBoard() as an alias to getBoard()", async () => {
    const mockBoard = {
      model: "Netcraze NC-1812",
      board_name: "nc-1812",
      release: { version: "25.12" },
    };

    vi.spyOn(ubusClient as any, "call").mockResolvedValueOnce(mockBoard);
    const res = await ubusClient.getSystemBoard();
    expect(res).toEqual(mockBoard);
  });

  it("should deduplicate concurrent login requests using a unified auth queue", async () => {
    let fetchCount = 0;
    // Mock global fetch
    const mockFetch = vi.fn().mockImplementation(() => {
      fetchCount++;
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            ok: true,
            status: 200,
            json: async () => ({
              jsonrpc: "2.0",
              id: 1,
              result: [0, { ubus_rpc_session: "unified_session_token_12345" }],
            }),
          });
        }, 30);
      });
    });
    vi.stubGlobal("fetch", mockFetch);

    // Trigger 5 concurrent logins simultaneously
    const [t1, t2, t3, t4, t5] = await Promise.all([
      ubusClient.login("root", "admin"),
      ubusClient.login("root", "admin"),
      ubusClient.login("root", "admin"),
      ubusClient.login("root", "admin"),
      ubusClient.login("root", "admin"),
    ]);

    expect(t1).toBe("unified_session_token_12345");
    expect(t2).toBe(t1);
    expect(t3).toBe(t1);
    expect(t4).toBe(t1);
    expect(t5).toBe(t1);

    // Only ONE network fetch must have been initiated due to the auth queue concurrency lock
    expect(fetchCount).toBe(1);
  });

  it("should reject requests on timeout using AbortSignal.timeout", async () => {
    const mockFetch = vi.fn().mockImplementation((_url, options) => {
      return new Promise((_resolve, reject) => {
        // If abort signal triggers, reject with TimeoutError
        if (options?.signal) {
          options.signal.addEventListener("abort", () => {
            const err = new Error("The operation was aborted due to timeout");
            err.name = "TimeoutError";
            reject(err);
          });
        }
      });
    });
    vi.stubGlobal("fetch", mockFetch);

    await expect(
      ubusClient.call("test", "timeout_method", {}, { timeoutMs: 20 })
    ).rejects.toThrow(/timed out/i);
  });
});
