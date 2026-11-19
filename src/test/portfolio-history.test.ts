import { describe, expect, it } from "vitest";
import {
  computePortfolioHistory,
  historyPeriodDays,
  historyPeriodLabel,
  rescaleSeriesToCurrent,
  withLiveEndpoint,
  type PortfolioHistory,
} from "@/lib/portfolio-history";
import type { Tx } from "@/lib/portfolio";

const DAY = 86_400_000;
const HOUR = 3_600_000;
const t0 = Date.UTC(2026, 10, 1); // 01/11/2026

const tx = (p: Partial<Tx>): Tx => ({
  id: crypto.randomUUID(),
  symbol: "BTC",
  coin_name: "Bitcoin",
  quantity: 1,
  price_usd: 100,
  fee_usd: 0,
  tx_date: "2026-11-01",
  note: null,
  ...p,
});

/** Nến ngày: giá đóng cửa tăng 100 → 110 → 120 … */
const daily = (closes: number[]) => closes.map((c, i) => ({ t: t0 + i * DAY, c }));

/** Nến giờ bắt đầu từ mốc cho trước. */
const hourly = (closes: number[], start: number) =>
  closes.map((c, i) => ({ t: start + i * HOUR, c }));

describe("lịch sử giá trị danh mục", () => {
  it("giá trị = số lượng đã mua tới ngày đó × giá đóng cửa gần nhất", () => {
    const h = computePortfolioHistory(
      [
        tx({ symbol: "BTC", quantity: 1, tx_date: "2026-11-01" }),
        tx({ symbol: "BTC", quantity: 1, tx_date: "2026-11-03" }),
      ],
      { BTC: daily([100, 110, 120, 130]) },
      t0,
      t0 + 3 * DAY,
    );
    // Ngày 1: 1×100; ngày 2: 1×110; ngày 3: 2×120; ngày 4: 2×130.
    expect(h.points.map((p) => p.value)).toEqual([100, 110, 240, 260]);
    expect(h.startValue).toBe(100);
    expect(h.endValue).toBe(260);
    // Tiền mua thêm trong kỳ (lần mua ngày 3: 1 × 100) KHÔNG tính là lãi.
    expect(h.deposits).toBe(100);
    expect(h.pnl).toBe(60);
    expect(h.pnlPct).toBeCloseTo(30, 6);
  });

  it("mua thêm trong kỳ không tính là lãi: giá trị tăng nhưng PNL âm", () => {
    // Mua 1 BTC ngày 1 (100), mua thêm 1 BTC ngày 2 (90), giá rớt còn 80:
    // giá trị 100 → 160 (tăng) nhưng thực tế lỗ 30 vì đã bỏ thêm 90.
    const h = computePortfolioHistory(
      [
        tx({ symbol: "BTC", quantity: 1, tx_date: "2026-11-01", price_usd: 100 }),
        tx({ symbol: "BTC", quantity: 1, tx_date: "2026-11-02", price_usd: 90 }),
      ],
      { BTC: daily([100, 90, 80]) },
      t0,
      t0 + 2 * DAY,
    );
    expect(h.points.map((p) => p.value)).toEqual([100, 180, 160]);
    expect(h.startValue).toBe(100);
    expect(h.deposits).toBe(90);
    expect(h.pnl).toBe(-30);
    expect(h.pnlPct).toBeCloseTo((-30 / 190) * 100, 6);
  });

  it("chưa mua gì đầu kỳ thì đường phẳng ở 0 từ đầu kỳ tới lần mua đầu", () => {
    // Mua 1 BTC duy nhất ngày 3: trước đó không có gì nên đường đi ngang
    // ở 0, rồi nhảy lên đúng ngày mua.
    const h = computePortfolioHistory(
      [tx({ symbol: "BTC", quantity: 1, tx_date: "2026-11-03" })],
      { BTC: daily([100, 110, 120, 130]) },
      t0,
      t0 + 3 * DAY,
    );
    expect(h.points).toEqual([
      { t: t0, value: 0 },
      { t: t0 + 2 * DAY, value: 0 },
      { t: t0 + 2 * DAY, value: 120 },
      { t: t0 + 3 * DAY, value: 130 },
    ]);
    expect(h.startValue).toBe(0);
    expect(h.deposits).toBe(100);
    expect(h.pnl).toBe(30);
  });

  it("kỳ 1D dùng nến giờ: mua trong ngày thì phẳng ở 0 rồi nhảy lên", () => {
    const start = t0 - 2 * HOUR; // 22:00 hôm qua, t0 = 00:00 hôm nay
    const h = computePortfolioHistory(
      [tx({ symbol: "BTC", quantity: 1, tx_date: "2026-11-01", price_usd: 100 })],
      { BTC: hourly([100, 105, 110, 120, 130], start) },
      start,
      start + 4 * HOUR,
    );
    // Trước 00:00 chưa mua gì nên phẳng ở 0; mua lúc 00:00 thì nhảy lên.
    expect(h.points).toEqual([
      { t: start, value: 0 },
      { t: t0, value: 0 },
      { t: t0, value: 110 },
      { t: t0 + HOUR, value: 120 },
      { t: t0 + 2 * HOUR, value: 130 },
    ]);
    expect(h.startValue).toBe(0);
    expect(h.deposits).toBe(100);
    expect(h.pnl).toBe(30);
  });

  it("đã mua từ trước kỳ thì đường bắt đầu ở đầu kỳ bằng giá trị lúc đó", () => {
    const h = computePortfolioHistory(
      [tx({ symbol: "BTC", quantity: 1, tx_date: "2026-10-01", price_usd: 100 })],
      { BTC: daily([100, 90, 80]) },
      t0,
      t0 + 2 * DAY,
    );
    expect(h.points[0]).toEqual({ t: t0, value: 100 });
    expect(h.points.map((p) => p.value)).toEqual([100, 90, 80]);
  });

  it("không mua thêm trong kỳ thì PNL là biến động giá thuần", () => {
    const h = computePortfolioHistory(
      [tx({ symbol: "BTC", quantity: 1, tx_date: "2026-10-01", price_usd: 100 })],
      { BTC: daily([100, 90, 80]) },
      t0,
      t0 + 2 * DAY,
    );
    expect(h.deposits).toBe(0);
    expect(h.pnl).toBe(-20);
    expect(h.pnlPct).toBe(-20);
  });

  it("tiền mua thêm gồm cả phí", () => {
    const h = computePortfolioHistory(
      [
        tx({ symbol: "BTC", quantity: 1, tx_date: "2026-11-01", price_usd: 100 }),
        tx({ symbol: "BTC", quantity: 1, tx_date: "2026-11-02", price_usd: 100, fee_usd: 5 }),
      ],
      { BTC: daily([100, 100, 100]) },
      t0,
      t0 + 2 * DAY,
    );
    expect(h.deposits).toBe(105);
    expect(h.pnl).toBe(-5);
  });

  it("cộng nhiều coin, mỗi coin dùng giá của chính nó", () => {
    const h = computePortfolioHistory(
      [
        tx({ symbol: "BTC", quantity: 1, tx_date: "2026-11-01" }),
        tx({ symbol: "ETH", quantity: 10, tx_date: "2026-11-02" }),
      ],
      {
        BTC: daily([100, 110]),
        ETH: daily([10, 20]),
      },
      t0,
      t0 + DAY,
    );
    expect(h.points.map((p) => p.value)).toEqual([100, 110 + 200]);
  });

  it("chưa mua gì hoặc không có giá thì rỗng", () => {
    expect(computePortfolioHistory([], { BTC: daily([100]) }, t0, t0).points).toEqual([]);
    expect(computePortfolioHistory([tx({})], {}, t0, t0 + DAY).points).toEqual([]);
  });

  it("một đồng đang nắm mà không có nến thì rỗng (không vẽ chart thiếu đồng đó)", () => {
    const h = computePortfolioHistory(
      [
        tx({ symbol: "BTC", quantity: 1, tx_date: "2026-11-01" }),
        tx({ symbol: "ETH", quantity: 10, tx_date: "2026-11-01" }),
      ],
      {
        BTC: daily([100, 110]),
        ETH: [],
      },
      t0,
      t0 + DAY,
    );
    expect(h.points).toEqual([]);
  });

  it("kỳ xem: 1D=1, 1W=7, 1M=30, 3M=90, 1Y=365 ngày", () => {
    expect(historyPeriodDays("1D")).toBe(1);
    expect(historyPeriodDays("1W")).toBe(7);
    expect(historyPeriodDays("1M")).toBe(30);
    expect(historyPeriodDays("3M")).toBe(90);
    expect(historyPeriodDays("1Y")).toBe(365);
    expect(historyPeriodLabel("1D")).toBe("1 ngày");
    expect(historyPeriodLabel("1M")).toBe("1 tháng");
    expect(historyPeriodLabel("1Y")).toBe("1 năm");
  });
});

describe("chốt điểm cuối bằng giá trị hiện tại", () => {
  const base: PortfolioHistory = {
    points: [
      { t: t0, value: 100 },
      { t: t0 + DAY, value: 120 },
    ],
    startValue: 100,
    endValue: 120,
    deposits: 0,
    pnl: 20,
    pnlPct: 20,
    fromMs: t0,
    toMs: t0 + 3 * DAY,
  };

  it("điểm cuối cũ hơn 1 giờ thì thêm điểm bây giờ", () => {
    const h = withLiveEndpoint(base, t0 + 3 * DAY, 150);
    expect(h.points).toHaveLength(3);
    expect(h.points[2]).toEqual({ t: t0 + 3 * DAY, value: 150 });
    expect(h.endValue).toBe(150);
    expect(h.pnl).toBe(50);
    expect(h.pnlPct).toBe(50);
  });

  it("điểm cuối còn mới thì ghi đè giá trị của nó", () => {
    const h = withLiveEndpoint(base, t0 + DAY + 30 * 60_000, 125);
    expect(h.points).toHaveLength(2);
    expect(h.points[1]?.value).toBe(125);
    expect(h.pnl).toBe(25);
  });

  it("không có giá live thì giữ nguyên", () => {
    expect(withLiveEndpoint(base, t0 + 3 * DAY, null)).toBe(base);
  });

  it("giữ tiền mua thêm và tính lại PNL theo giá live", () => {
    const withDeposits: PortfolioHistory = {
      ...base,
      deposits: 50,
      pnl: -30,
      pnlPct: -20,
    };
    const h = withLiveEndpoint(withDeposits, t0 + 3 * DAY, 150);
    expect(h.deposits).toBe(50);
    expect(h.endValue).toBe(150);
    expect(h.pnl).toBe(0);
    expect(h.pnlPct).toBe(0);
  });
});

import { nearestPointIndex } from "@/components/app/portfolio-chart";

describe("điểm gần nhất theo thời gian cho hover", () => {
  const pts = [
    { t: 0, value: 10 },
    { t: 10, value: 20 },
    { t: 20, value: 30 },
  ];

  it("chọn điểm có mốc thời gian gần nhất", () => {
    expect(nearestPointIndex(pts, 0)).toBe(0);
    expect(nearestPointIndex(pts, 12)).toBe(1);
    expect(nearestPointIndex(pts, 19)).toBe(2);
    expect(nearestPointIndex(pts, 100)).toBe(2);
    expect(nearestPointIndex([], 5)).toBe(null);
  });
});

describe("neo chuỗi giá thế giới về giá trong nước", () => {
  it("nhân hệ số để điểm cuối khớp giá hiện tại, giữ tỉ lệ xu hướng", () => {
    const s = rescaleSeriesToCurrent(
      [
        { t: t0, c: 100 },
        { t: t0 + DAY, c: 110 },
      ],
      121,
    );
    expect(s[1]?.c).toBeCloseTo(121, 6);
    expect(s[0]?.c).toBeCloseTo(110, 6);
  });

  it("không có giá hiện tại thì giữ nguyên chuỗi", () => {
    const s = [
      { t: t0, c: 100 },
      { t: t0 + DAY, c: 110 },
    ];
    expect(rescaleSeriesToCurrent(s, null)).toBe(s);
  });
});

describe("bán / đổi token trong kỳ", () => {
  it("bán một phần: số lượng giảm, tiền bán thu về được cộng lại khi tính PNL", () => {
    // Mua 1 BTC ngày 1 giá 100. Bán 0,5 BTC ngày 3 giá 120 (thu 60).
    // Giá đóng cửa: 100, 110, 120, 130.
    const h = computePortfolioHistory(
      [
        tx({ symbol: "BTC", quantity: 1, price_usd: 100, tx_date: "2026-11-01" }),
        tx({ symbol: "BTC", quantity: -0.5, price_usd: 120, tx_date: "2026-11-03" }),
      ],
      { BTC: daily([100, 110, 120, 130]) },
      t0,
      t0 + 3 * DAY,
    );
    // Ngày 1: 1×100; ngày 2: 1×110; ngày 3: 0,5×120; ngày 4: 0,5×130.
    expect(h.points.map((p) => p.value)).toEqual([100, 110, 60, 65]);
    expect(h.startValue).toBe(100);
    expect(h.endValue).toBe(65);
    expect(h.deposits).toBe(0);
    expect(h.withdrawals).toBe(60);
    // PNL = 65 − 100 − 0 + 60 = 25 (lãi 10 từ bán + lãi 15 từ 0,5 còn lại).
    expect(h.pnl).toBe(25);
    expect(h.pnlPct).toBeCloseTo(25, 6);
  });

  it("đổi toàn bộ 1 token sang token khác: chart không biến mất, PNL đúng", () => {
    // Mua 1 BTC ngày 1 giá 100. Ngày 3 đổi 100% BTC → 2 ETH (BTC 120, ETH 60).
    // Giá BTC: 100, 110, 120, 130. Giá ETH: 50, 55, 60, 70.
    const h = computePortfolioHistory(
      [
        tx({ symbol: "BTC", quantity: 1, price_usd: 100, tx_date: "2026-11-01" }),
        tx({ symbol: "BTC", quantity: -1, price_usd: 120, tx_date: "2026-11-03" }),
        tx({ symbol: "ETH", quantity: 2, price_usd: 60, tx_date: "2026-11-03" }),
      ],
      { BTC: daily([100, 110, 120, 130]), ETH: daily([50, 55, 60, 70]) },
      t0,
      t0 + 3 * DAY,
    );
    expect(h.points.length).toBeGreaterThan(0);
    // Ngày 1: 1×100; ngày 2: 1×110; ngày 3: 2×60; ngày 4: 2×70.
    expect(h.points.map((p) => p.value)).toEqual([100, 110, 120, 140]);
    expect(h.startValue).toBe(100);
    expect(h.endValue).toBe(140);
    expect(h.deposits).toBe(120);
    expect(h.withdrawals).toBe(120);
    // PNL = 140 − 100 − 120 + 120 = 40 (lãi 20 từ BTC + lãi 20 từ ETH).
    // % = 40 / (100 + 120) = 18,18% (vốn = giá trị đầu kỳ + tiền mua thêm).
    expect(h.pnl).toBe(40);
    expect(h.pnlPct).toBeCloseTo((40 / 220) * 100, 6);
  });

  it("đồng đã bán hết trước đầu kỳ và không có giao dịch trong kỳ thì không cần nến", () => {
    // Mua 1 BTC ngày 1, bán hết ngày 2 (trước đầu kỳ ngày 3) — kỳ bắt đầu ngày 3.
    // Lần mua ETH ngày 3 rơi đúng ngày đầu kỳ nên tính vào giá trị đầu kỳ
    // (ngày giao dịch không có giờ — hành vi biên đã có sẵn).
    const h = computePortfolioHistory(
      [
        tx({ symbol: "BTC", quantity: 1, price_usd: 100, tx_date: "2026-11-01" }),
        tx({ symbol: "BTC", quantity: -1, price_usd: 110, tx_date: "2026-11-02" }),
        tx({ symbol: "ETH", quantity: 1, price_usd: 50, tx_date: "2026-11-03" }),
      ],
      { ETH: daily([50, 55, 60, 65, 70]) },
      t0 + 2 * DAY,
      t0 + 4 * DAY,
    );
    expect(h.points.length).toBeGreaterThan(0);
    expect(h.points.map((p) => p.value)).toEqual([60, 65, 70]);
    expect(h.startValue).toBe(60);
  });
});
