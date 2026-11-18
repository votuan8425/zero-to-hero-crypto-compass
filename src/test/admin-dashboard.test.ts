import { describe, expect, it } from "vitest";
import {
  computeAdminUserStats,
  parseAdminUsers,
  type AdminHolding,
} from "@/lib/admin-dashboard";
import type { PriceMap } from "@/lib/portfolio";

const prices = (over: Record<string, Partial<PriceMap[string]>> = {}): PriceMap => {
  const base: PriceMap = {
    BTC: { usd: 60000, vnd: 60000 * 25000, krw: 0, change24h: 0 },
    ETH: { usd: 3000, vnd: 3000 * 25000, krw: 0, change24h: 0 },
    PAXG: { usd: 0, vnd: 13420000, krw: 0, change24h: null, askVnd: 13723000, source: "SJC" },
  };
  for (const [k, v] of Object.entries(over)) base[k] = { ...base[k]!, ...v };
  return base;
};

const holding = (over: Partial<AdminHolding> = {}): AdminHolding => ({
  symbol: "BTC",
  coin_name: "Bitcoin",
  quantity: 1,
  invested_usd: 50000,
  invested_vnd: null,
  ...over,
});

describe("computeAdminUserStats", () => {
  it("values by live price and computes pnl", () => {
    const s = computeAdminUserStats([holding()], prices(), 25000);
    expect(s.investedUsd).toBe(50000);
    expect(s.valueUsd).toBe(60000);
    expect(s.pnlUsd).toBe(10000);
    expect(s.pnlPct).toBeCloseTo(20, 10);
    expect(s.basis).toBe("value");
    expect(s.slices).toEqual([{ symbol: "BTC", name: "Bitcoin", percent: 100 }]);
  });

  it("allocates by value across coins", () => {
    const s = computeAdminUserStats(
      [
        holding({ quantity: 1, invested_usd: 50000 }),
        holding({ symbol: "ETH", coin_name: "Ethereum", quantity: 10, invested_usd: 25000 }),
      ],
      prices(),
      25000,
    );
    expect(s.valueUsd).toBe(90000);
    expect(s.slices.map((x) => [x.symbol, Math.round(x.percent * 100) / 100])).toEqual([
      ["BTC", 66.67],
      ["ETH", 33.33],
    ]);
  });

  it("falls back to cost basis when a price is missing", () => {
    const s = computeAdminUserStats(
      [holding(), holding({ symbol: "SOL", coin_name: "Solana", invested_usd: 50000 })],
      prices(),
      25000,
    );
    expect(s.valueUsd).toBeNull();
    expect(s.pnlUsd).toBeNull();
    expect(s.basis).toBe("cost");
    expect(s.slices).toHaveLength(2);
    expect(s.slices[0]?.percent).toBeCloseTo(50, 10);
  });

  it("values metals from VND bid through the FX rate", () => {
    const s = computeAdminUserStats(
      [
        holding({
          symbol: "PAXG",
          coin_name: "Vàng",
          quantity: 2,
          invested_usd: 1000,
          invested_vnd: 26000000,
        }),
      ],
      prices(),
      25000,
    );
    // 2 chỉ x 13.420.000 vnđ = 26.840.000 vnđ / 25.000 = 1073,6 USDT
    expect(s.valueUsd).toBeCloseTo(1073.6, 6);
    expect(s.pnlUsd).toBeCloseTo(73.6, 6);
  });

  it("returns empty stats for no holdings", () => {
    const s = computeAdminUserStats([], prices(), 25000);
    expect(s).toEqual({
      investedUsd: 0,
      valueUsd: null,
      pnlUsd: null,
      pnlPct: null,
      slices: [],
      basis: "cost",
    });
  });
});

describe("parseAdminUsers", () => {
  it("coerces rows, normalizes currency and symbols, sorts holdings", () => {
    const out = parseAdminUsers([
      {
        user_id: "u1",
        email: "a@example.com",
        username: "alice",
        display_name: "Alice",
        currency: "USD",
        created_at: "2026-01-01T00:00:00Z",
        last_sign_in_at: null,
        tx_count: "3",
        invested_usd: "1200.5",
        holdings: [
          { symbol: "eth", coin_name: "Ethereum", quantity: "2", invested_usd: "400", invested_vnd: null },
          { symbol: "BTC", coin_name: "Bitcoin", quantity: 1, invested_usd: 800, invested_vnd: null },
        ],
      },
      { user_id: "", email: "ghost@example.com" },
      null,
    ]);
    expect(out).toHaveLength(1);
    const u = out[0]!;
    expect(u.currency).toBe("USDT");
    expect(u.tx_count).toBe(3);
    expect(u.invested_usd).toBe(1200.5);
    expect(u.holdings.map((h) => h.symbol)).toEqual(["BTC", "ETH"]);
  });

  it("returns [] for non-array input and empty holdings for null", () => {
    expect(parseAdminUsers(null)).toEqual([]);
    expect(parseAdminUsers("nope")).toEqual([]);
    const out = parseAdminUsers([{ user_id: "u2", holdings: null }]);
    expect(out).toHaveLength(1);
    expect(out[0]?.holdings).toEqual([]);
    expect(out[0]?.currency).toBe("VND");
  });
});
