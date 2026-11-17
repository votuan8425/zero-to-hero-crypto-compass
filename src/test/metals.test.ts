import { describe, expect, it } from "vitest";
import { COINS, coinName, getCoin } from "@/lib/coins";
import { GOLD_SYMBOL, SILVER_SYMBOL } from "@/lib/prices.functions";
import { computeAllocation, computeHoldings, computeTotals, type Tx } from "@/lib/portfolio";

const symbols = COINS.map((c) => c.symbol);

const tx = (p: Partial<Tx>): Tx => ({
  id: crypto.randomUUID(),
  symbol: "BTC",
  coin_name: "Bitcoin",
  quantity: 1,
  price_usd: 100,
  fee_usd: 0,
  tx_date: "2026-11-10",
  note: null,
  ...p,
});

describe("vàng và bạc trong danh sách mua", () => {
  it("đứng ngay sau ETH: BTC, ETH, Vàng, Bạc rồi mới tới SOL", () => {
    expect(symbols.slice(0, 5)).toEqual(["BTC", "ETH", "PAXG", "KAG", "SOL"]);
  });

  it("hiển thị tên tiếng Việt Vàng và Bạc", () => {
    expect(getCoin("PAXG")?.name).toBe("Vàng");
    expect(getCoin("KAG")?.name).toBe("Bạc");
    expect(coinName("PAXG")).toBe("Vàng");
    expect(coinName("KAG")).toBe("Bạc");
  });

  it("dùng đúng symbol proxy giá đã có: vàng PAXG, bạc KAG", () => {
    expect(GOLD_SYMBOL).toBe("PAXG");
    expect(SILVER_SYMBOL).toBe("KAG");
    expect(getCoin(GOLD_SYMBOL)?.geckoId).toBe("pax-gold");
    expect(getCoin(SILVER_SYMBOL)?.geckoId).toBe("kinesis-silver");
  });

  it("số lượng kim loại quý tính theo ounce", () => {
    expect(getCoin("PAXG")?.unit).toBe("ounce");
    expect(getCoin("KAG")?.unit).toBe("ounce");
    expect(getCoin("BTC")?.unit).toBeUndefined();
  });
});

describe("giá trị danh mục của vàng và bạc", () => {
  const prices = {
    PAXG: { usd: 3900, vnd: 0, change24h: 1 },
    KAG: { usd: 47.78, vnd: 0, change24h: 0.3 },
  };

  it("tính giá trị hiện tại và lãi/lỗ theo đúng giá proxy", () => {
    const holdings = computeHoldings(
      [
        tx({ symbol: "PAXG", coin_name: "Vàng", quantity: 2, price_usd: 3800 }),
        tx({ symbol: "KAG", coin_name: "Bạc", quantity: 10, price_usd: 45 }),
      ],
      prices,
    );
    const gold = holdings.find((h) => h.symbol === "PAXG");
    const silver = holdings.find((h) => h.symbol === "KAG");
    expect(gold?.name).toBe("Vàng");
    expect(gold?.valueUsd).toBe(7800);
    expect(gold?.pnlUsd).toBe(200);
    expect(silver?.name).toBe("Bạc");
    expect(silver?.valueUsd).toBeCloseTo(477.8, 6);
    expect(silver?.pnlUsd).toBeCloseTo(27.8, 6);
    const totals = computeTotals(holdings);
    expect(totals.valueUsd).toBeCloseTo(8277.8, 6);
  });

  it("chưa có giá thì vẫn giữ vốn, không bịa giá trị", () => {
    const holdings = computeHoldings(
      [tx({ symbol: "KAG", coin_name: "Bạc", quantity: 10, price_usd: 45 })],
      {},
    );
    expect(holdings[0]?.valueUsd).toBeNull();
    expect(holdings[0]?.investedUsd).toBe(450);
    expect(computeTotals(holdings).valueUsd).toBeNull();
  });

  it("phân bổ danh mục có cả vàng và bạc", () => {
    const holdings = computeHoldings(
      [
        tx({ symbol: "PAXG", coin_name: "Vàng", quantity: 1, price_usd: 3900 }),
        tx({ symbol: "KAG", coin_name: "Bạc", quantity: 10, price_usd: 47.78 }),
      ],
      prices,
    );
    const { slices } = computeAllocation(holdings);
    expect(slices.map((s) => s.symbol).sort()).toEqual(["KAG", "PAXG"]);
    expect(slices.reduce((s, x) => s + x.percent, 0)).toBeCloseTo(100, 6);
  });
});
