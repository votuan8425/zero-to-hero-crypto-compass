import { describe, expect, it } from "vitest";
import {
  applyMetalsFreeze,
  currentMetalsSlot,
  deriveBidAsk,
} from "@/lib/metals";
import type { PricesResult } from "@/lib/prices.functions";

function withStorage(value: string | null) {
  const store = new Map<string, string>();
  if (value !== null) store.set("zth:metals", value);
  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => store.delete(k),
    },
    configurable: true,
  });
  return store;
}

function pricesResult(paxgUsd: number, btcUsd: number): PricesResult {
  return {
    prices: {
      PAXG: {
        usd: paxgUsd,
        vnd: paxgUsd * 26000,
        krw: 0,
        change24h: 1,
        bidVnd: paxgUsd * 26000 - 1000,
        askVnd: paxgUsd * 26000 + 1000,
      },
      KAG: { usd: 47, vnd: 47 * 26000, krw: 0, change24h: 0.5 },
      BTC: { usd: btcUsd, vnd: btcUsd * 26000, krw: 0, change24h: 2 },
    },
    usdVnd: 26000,
    usdKrw: 1380,
    fetchedAt: new Date().toISOString(),
    error: null,
  };
}

describe("currentMetalsSlot", () => {
  it("trước 6h sáng thì khung là 22h hôm trước", () => {
    expect(currentMetalsSlot(new Date("2026-11-18T05:59:00+07:00"))).toBe("2026-11-17-22");
    expect(currentMetalsSlot(new Date("2026-11-18T02:30:00+07:00"))).toBe("2026-11-17-22");
  });
  it("từ 6h đến trước 22h là khung 6h cùng ngày", () => {
    expect(currentMetalsSlot(new Date("2026-11-18T06:00:00+07:00"))).toBe("2026-11-18-06");
    expect(currentMetalsSlot(new Date("2026-11-18T15:30:00+07:00"))).toBe("2026-11-18-06");
    expect(currentMetalsSlot(new Date("2026-11-18T21:59:00+07:00"))).toBe("2026-11-18-06");
  });
  it("từ 22h là khung 22h cùng ngày", () => {
    expect(currentMetalsSlot(new Date("2026-11-18T22:00:00+07:00"))).toBe("2026-11-18-22");
    expect(currentMetalsSlot(new Date("2026-11-18T23:30:00+07:00"))).toBe("2026-11-18-22");
  });
  it("tính theo giờ Việt Nam, không theo giờ UTC của máy", () => {
    // 23:30 UTC ngày 17 = 06:30 giờ VN ngày 18.
    expect(currentMetalsSlot(new Date("2026-11-17T23:30:00Z"))).toBe("2026-11-18-06");
  });
});

describe("deriveBidAsk", () => {
  it("mua vào thấp hơn, bán ra cao hơn, chênh đúng spread", () => {
    const { bid, ask } = deriveBidAsk(45.75, 0.113676);
    expect(bid).toBeCloseTo(45.724, 3);
    expect(ask).toBeCloseTo(45.776, 3);
    expect(bid).toBeLessThan(45.75);
    expect(ask).toBeGreaterThan(45.75);
  });
  it("spread 0 thì mua bằng bán bằng giá last", () => {
    expect(deriveBidAsk(100, 0)).toEqual({ bid: 100, ask: 100 });
  });
});

describe("applyMetalsFreeze", () => {
  it("trong cùng khung giờ: vàng/bạc giữ giá đã chốt, coin khác vẫn mới", () => {
    withStorage(null);
    const first = applyMetalsFreeze(pricesResult(3800, 65000));
    expect(first.prices["PAXG"]?.usd).toBe(3800);
    // Tải lại cùng khung, giá vàng mới hơn nhưng phải giữ giá chốt cũ.
    const second = applyMetalsFreeze(pricesResult(3900, 66000));
    expect(second.prices["PAXG"]?.usd).toBe(3800);
    expect(second.prices["PAXG"]?.bidVnd).toBe(3800 * 26000 - 1000);
    expect(second.prices["BTC"]?.usd).toBe(66000);
  });
  it("sang khung mới: vàng/bạc nhận giá mới và chốt lại", () => {
    const store = withStorage(
      JSON.stringify({
        slot: "2000-01-01-06",
        quotes: {
          PAXG: { usd: 3000, vnd: 3000 * 26000, krw: 0, change24h: 0 },
        },
      }),
    );
    const res = applyMetalsFreeze(pricesResult(3800, 65000));
    expect(res.prices["PAXG"]?.usd).toBe(3800);
    const saved = JSON.parse(store.get("zth:metals") ?? "{}") as { slot: string };
    expect(saved.slot).toBe(currentMetalsSlot());
    expect(saved.slot).not.toBe("2000-01-01-06");
  });
});
