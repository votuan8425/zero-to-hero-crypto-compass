import { describe, expect, it } from "vitest";
import {
  earliestTxDate,
  formatDurationSince,
  groupByMonth,
  monthLabel,
  yearTotals,
} from "@/lib/accumulation";
import type { Tx } from "@/lib/portfolio";

function tx(date: string, qty = 1, price = 100, fee = 0): Tx {
  return {
    id: date,
    symbol: "BTC",
    coin_name: "Bitcoin",
    quantity: qty,
    price_usd: price,
    fee_usd: fee,
    tx_date: date,
    note: null,
  };
}

describe("groupByMonth", () => {
  it("nhóm theo tháng, mới nhất trước, tính đúng tổng vốn", () => {
    const groups = groupByMonth([
      tx("2026-11-05", 1, 100),
      tx("2026-10-20", 2, 50, 5),
      tx("2026-11-15", 1, 200),
    ]);
    expect(groups.map((g) => g.key)).toEqual(["2026-11", "2026-10"]);
    expect(groups[0]?.buys).toBe(2);
    expect(groups[0]?.investedUsd).toBe(300);
    expect(groups[1]?.investedUsd).toBe(105);
  });

  it("nhãn tháng tiếng Việt", () => {
    expect(monthLabel("2026-11")).toBe("Tháng 11 2026");
    expect(monthLabel("2025-01")).toBe("Tháng 1 2025");
  });

  it("tổng theo năm", () => {
    const groups = groupByMonth([tx("2026-11-05", 1, 100), tx("2025-12-01", 1, 50)]);
    expect(yearTotals(groups, 2026)).toEqual({ buys: 1, investedUsd: 100 });
    expect(yearTotals(groups, 2025)).toEqual({ buys: 1, investedUsd: 50 });
  });
});

describe("formatDurationSince", () => {
  const now = new Date(2026, 10, 17); // 17/11/2026
  it("hơn 1 năm thì ghi năm + tháng", () => {
    expect(formatDurationSince("2025-08-10", now)).toBe("1 năm 3 tháng");
  });
  it("dưới 1 năm thì chỉ ghi tháng", () => {
    expect(formatDurationSince("2026-03-17", now)).toBe("8 tháng");
  });
  it("dưới 1 tháng thì ghi ngày", () => {
    expect(formatDurationSince("2026-11-05", now)).toBe("12 ngày");
  });
  it("cùng ngày thì là hôm nay", () => {
    expect(formatDurationSince("2026-11-17", now)).toBe("Hôm nay");
  });
});

describe("earliestTxDate", () => {
  it("trả về ngày mua đầu tiên", () => {
    expect(earliestTxDate([tx("2026-11-05"), tx("2025-01-02"), tx("2026-01-01")])).toBe(
      "2025-01-02",
    );
  });
  it("không có giao dịch thì null", () => {
    expect(earliestTxDate([])).toBeNull();
  });
});
