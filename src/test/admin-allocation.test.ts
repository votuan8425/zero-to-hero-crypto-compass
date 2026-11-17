import { describe, expect, it } from "vitest";
import { allocationChanged, buildAdminAllocationSlices } from "@/lib/admin-allocation";
import type { AllocationSlice } from "@/lib/portfolio";

describe("admin allocation payload is percent-only", () => {
  it("keeps only symbol, name and percent (drops quantity/value/invested)", () => {
    const raw = [
      {
        symbol: "BTC",
        name: "Bitcoin",
        percent: 45.123,
        quantity: 1.5,
        valueUsd: 90000,
        investedUsd: 80000,
        note: "secret",
      },
      { symbol: "ETH", name: "Ethereum", percent: 25, quantity: 10, valueUsd: 50000 },
    ] as unknown as AllocationSlice[];
    const out = buildAdminAllocationSlices(raw);
    expect(out).toEqual([
      { symbol: "BTC", name: "Bitcoin", percent: 45.12 },
      { symbol: "ETH", name: "Ethereum", percent: 25 },
    ]);
    for (const s of out) {
      expect(Object.keys(s).sort()).toEqual(["name", "percent", "symbol"]);
      expect(JSON.stringify(s)).not.toMatch(/quantity|value|invested|note/i);
    }
  });
  it("rounds to 2 decimals, drops zero slices and sorts by percent desc", () => {
    const out = buildAdminAllocationSlices([
      { symbol: "SOL", name: "Solana", percent: 10.005 },
      { symbol: "BTC", name: "Bitcoin", percent: 60 },
      { symbol: "DOGE", name: "Dogecoin", percent: 0 },
    ]);
    expect(out.map((s) => s.symbol)).toEqual(["BTC", "SOL"]);
    expect(out[1]?.percent).toBe(10.01);
  });
});

describe("allocationChanged", () => {
  it("ignores changes of 0.01 or less, flags bigger ones", () => {
    const prev = [{ symbol: "BTC", name: "Bitcoin", percent: 45 }];
    expect(allocationChanged(prev, [{ symbol: "BTC", name: "Bitcoin", percent: 45.01 }])).toBe(
      false,
    );
    expect(allocationChanged(prev, [{ symbol: "BTC", name: "Bitcoin", percent: 45.02 }])).toBe(
      true,
    );
    expect(allocationChanged(prev, [{ symbol: "ETH", name: "Ethereum", percent: 45 }])).toBe(true);
    expect(allocationChanged(null, [{ symbol: "BTC", name: "Bitcoin", percent: 45 }])).toBe(true);
    expect(allocationChanged(prev, prev)).toBe(false);
  });
});
