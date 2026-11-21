import { describe, expect, it } from "vitest";
import { computeHoldings, computeStreak, computeTotals, type Tx } from "@/lib/portfolio";
import {
  analyzeConcentration,
  checkPercentSum,
  compareAllocations,
  fillPercentFromValues,
  type RefHolding,
} from "@/lib/reference";
import { applyPending, coalesce, decideConflict, type PendingOp } from "@/lib/offline-queue";
import { parseLegacyRecord } from "@/lib/legacy-migration";

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
const h = (p: Partial<RefHolding>): RefHolding => ({
  symbol: "BTC",
  name: null,
  percent: null,
  percent_source: "extracted",
  quantity: null,
  value: null,
  value_currency: null,
  confidence: "high",
  ...p,
});

describe("portfolio math", () => {
  it("averages cost across DCA purchases including fees", () => {
    const [btc] = computeHoldings([
      tx({ quantity: 1, price_usd: 100, fee_usd: 2 }),
      tx({ quantity: 1, price_usd: 200 }),
    ]);
    expect(btc?.quantity).toBe(2);
    expect(btc?.investedUsd).toBe(302);
    expect(btc?.avgCostUsd).toBe(151);
  });

  it("computes profit/loss from live price", () => {
    const holdings = computeHoldings([tx({ quantity: 2, price_usd: 100 })], {
      BTC: { usd: 150, vnd: 0, krw: 0, change24h: null },
    });
    const totals = computeTotals(holdings);
    expect(totals.valueUsd).toBe(300);
    expect(totals.pnlUsd).toBe(100);
    expect(totals.pnlPct).toBe(50);
  });

  it("làm tròn số lượng về 8 chữ số thập phân (0,1×3 = 0,3, không phải 0,30000000000000004)", () => {
    const [btc] = computeHoldings([
      tx({ quantity: 0.1, price_usd: 100 }),
      tx({ quantity: 0.1, price_usd: 100 }),
      tx({ quantity: 0.1, price_usd: 100 }),
    ]);
    // Không làm tròn thì JS cộng dồn ra 0.30000000000000004 — nút "Tối đa"
    // ở Swap sẽ hiện số lẻ dài đó và gây nhầm lẫn.
    expect(btc?.quantity).toBe(0.3);
  });

  it("đổi 100% sau khi làm tròn thì hết sạch, không còn bụi 4e-17", () => {
    const [btc] = computeHoldings([
      tx({ quantity: 0.1, price_usd: 100 }),
      tx({ quantity: 0.1, price_usd: 100 }),
      tx({ quantity: 0.1, price_usd: 100 }),
      tx({ quantity: -0.3, price_usd: 150, tx_date: "2026-11-11" }),
    ]);
    expect(btc?.quantity).toBe(0);
  });
});

describe("bán / swap giữ đúng giá mua trung bình (avg cost)", () => {
  it("bán một phần ở giá cao hơn: vốn còn lại = số lượng còn × avg cost", () => {
    const [btc] = computeHoldings([
      tx({ quantity: 10, price_usd: 100 }),
      tx({ quantity: -5, price_usd: 120, tx_date: "2026-11-11" }),
    ]);
    expect(btc?.quantity).toBe(5);
    expect(btc?.investedUsd).toBe(500);
    expect(btc?.avgCostUsd).toBe(100);
  });

  it("bán hết: vốn về 0, không còn lần mua", () => {
    const [btc] = computeHoldings([
      tx({ quantity: 2, price_usd: 100 }),
      tx({ quantity: -2, price_usd: 150, tx_date: "2026-11-11" }),
    ]);
    expect(btc?.quantity).toBe(0);
    expect(btc?.investedUsd).toBe(0);
    expect(btc?.avgCostUsd).toBe(0);
    expect(btc?.purchases).toBe(1);
  });

  it("bán một phần sau nhiều lần mua giá khác nhau: avg cost không đổi", () => {
    const [btc] = computeHoldings([
      tx({ quantity: 1, price_usd: 100 }),
      tx({ quantity: 1, price_usd: 200, tx_date: "2026-11-11" }),
      tx({ quantity: -1, price_usd: 300, tx_date: "2026-11-12" }),
    ]);
    expect(btc?.quantity).toBe(1);
    expect(btc?.investedUsd).toBe(150);
    expect(btc?.avgCostUsd).toBe(150);
  });

  it("phí bán không cộng vào vốn còn lại", () => {
    const [btc] = computeHoldings([
      tx({ quantity: 10, price_usd: 100 }),
      tx({ quantity: -5, price_usd: 120, fee_usd: 3, tx_date: "2026-11-11" }),
    ]);
    expect(btc?.investedUsd).toBe(500);
    expect(btc?.avgCostUsd).toBe(100);
  });

  it("xử lý theo thứ tự ngày, không theo thứ tự mảng truyền vào", () => {
    const [btc] = computeHoldings([
      tx({ quantity: -1, price_usd: 300, tx_date: "2026-11-12" }),
      tx({ quantity: 1, price_usd: 200, tx_date: "2026-11-11" }),
      tx({ quantity: 1, price_usd: 100, tx_date: "2026-11-10" }),
    ]);
    expect(btc?.quantity).toBe(1);
    expect(btc?.investedUsd).toBe(150);
    expect(btc?.avgCostUsd).toBe(150);
  });

  it("bán vàng: vốn VND giảm theo avg cost VND", () => {
    const [gold] = computeHoldings(
      [
        tx({
          symbol: "PAXG",
          coin_name: "Vàng",
          quantity: 4,
          price_usd: 3800,
          price_vnd: 13_420_000,
        }),
        tx({
          symbol: "PAXG",
          coin_name: "Vàng",
          quantity: -1,
          price_usd: 3900,
          price_vnd: 13_723_000,
          tx_date: "2026-11-11",
        }),
      ],
      {},
    );
    expect(gold?.quantity).toBe(3);
    expect(gold?.investedVnd).toBe(3 * 13_420_000);
    expect(gold?.avgCostVnd).toBe(13_420_000);
  });
});

describe("accumulation streak", () => {
  const today = new Date(2026, 10, 16);
  it("counts consecutive days ending today", () => {
    expect(computeStreak(["2026-11-14", "2026-11-15", "2026-11-16"], today).current).toBe(3);
  });
  it("keeps the streak alive if last purchase was yesterday", () => {
    expect(computeStreak(["2026-11-14", "2026-11-15"], today).current).toBe(2);
  });
  it("breaks the streak after a missed day", () => {
    const s = computeStreak(["2026-11-10", "2026-11-11", "2026-11-12", "2026-11-14"], today);
    expect(s.current).toBe(0);
    expect(s.longest).toBe(3);
  });
});

describe("reference portfolios", () => {
  it("accepts percentages summing to 100%", () => {
    expect(
      checkPercentSum([
        h({ percent: 45 }),
        h({ percent: 25 }),
        h({ percent: 15 }),
        h({ percent: 10 }),
        h({ percent: 5 }),
      ]).ok,
    ).toBe(true);
  });
  it("flags percentages that do not add up to 100%", () => {
    const c = checkPercentSum([h({ percent: 45 }), h({ percent: 25 }), h({ percent: 15 })]);
    expect(c.ok).toBe(false);
    expect(c.diff).toBe(15);
  });
  it("flags rows with unknown percentages", () => {
    expect(checkPercentSum([h({ percent: 100 }), h({ symbol: "ETH", percent: null })]).ok).toBe(
      false,
    );
  });
  it("only fills missing percentages when every value is visible, marking them as estimated", () => {
    const filled = fillPercentFromValues([h({ value: 750 }), h({ symbol: "ETH", value: 250 })]);
    expect(filled.map((x) => x.percent)).toEqual([75, 25]);
    expect(filled[0]?.percent_source).toBe("computed");
    const untouched = fillPercentFromValues([h({ value: 750 }), h({ symbol: "ETH", value: null })]);
    expect(untouched.every((x) => x.percent === null)).toBe(true);
  });
  it("compares my allocation with a reference", () => {
    const rows = compareAllocations(
      [
        { symbol: "BTC", percent: 35 },
        { symbol: "ETH", percent: 40 },
      ],
      [h({ percent: 45 }), h({ symbol: "ETH", percent: 25 })],
    );
    expect(rows.find((r) => r.symbol === "BTC")?.diff).toBe(-10);
    expect(rows.find((r) => r.symbol === "ETH")?.diff).toBe(15);
  });
  it("labels a 60/25/10/5 portfolio as concentrated", () => {
    expect(
      analyzeConcentration([
        { symbol: "BTC", percent: 60 },
        { symbol: "ETH", percent: 25 },
        { symbol: "SOL", percent: 10 },
        { symbol: "KHAC", percent: 5 },
      ]).label,
    ).toBe("Tập trung");
  });
});

describe("offline sync", () => {
  const row = { ...tx({ id: "a" }), user_id: "u" };
  it("collapses repeated offline edits into one write (no duplicates)", () => {
    let q: PendingOp[] = [];
    q = coalesce(q, { kind: "upsert", id: "a", row, queuedAt: 1, baseUpdatedAt: null });
    q = coalesce(q, {
      kind: "upsert",
      id: "a",
      row: { ...row, quantity: 2 },
      queuedAt: 2,
      baseUpdatedAt: null,
    });
    expect(q).toHaveLength(1);
    expect(applyPending([], q)[0]?.quantity).toBe(2);
  });
  it("drops a purchase created and deleted while offline", () => {
    let q: PendingOp[] = [{ kind: "upsert", id: "a", row, queuedAt: 1, baseUpdatedAt: null }];
    q = coalesce(q, { kind: "delete", id: "a", queuedAt: 2, baseUpdatedAt: null });
    expect(q).toHaveLength(0);
  });
  it("lets a newer edit from another device win over an older offline edit", () => {
    const op: PendingOp = {
      kind: "upsert",
      id: "a",
      row,
      queuedAt: Date.parse("2026-11-16T10:00:00Z"),
      baseUpdatedAt: "2026-11-16T09:00:00Z",
    };
    expect(decideConflict(op, { updated_at: "2026-11-16T11:00:00Z" })).toBe("skip-server-newer");
    expect(decideConflict(op, { updated_at: "2026-11-16T09:00:00Z" })).toBe("apply");
    expect(decideConflict(op, null)).toBe("skip-deleted");
  });
});

describe("legacy migration", () => {
  it("gives the same record the same import key so re-imports are skipped", () => {
    const a = parseLegacyRecord(
      { coin: "btc", amount: 1, price: 64000, date: "2026-01-02" },
      "localStorage:x",
    );
    const b = parseLegacyRecord(
      { coin: "btc", amount: 1, price: 64000, date: "2026-01-02" },
      "localStorage:x",
    );
    expect(a?.importKey).toBe(b?.importKey);
    expect(a?.symbol).toBe("BTC");
  });
  it("ignores sell records and non-purchase objects", () => {
    expect(parseLegacyRecord({ coin: "btc", amount: 1, type: "sell" }, "s")).toBeNull();
    expect(parseLegacyRecord({ theme: "dark" }, "s")).toBeNull();
  });
});
