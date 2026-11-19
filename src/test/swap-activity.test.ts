import { describe, expect, it } from "vitest";
import {
  actionPercent,
  estimateReceive,
  isFullPosition,
  roundActionPercent,
  swapRate,
} from "@/lib/swap";
import { activityDetail, activityLabel, allocationSummary, type Activity } from "@/lib/activity";

const act = (p: Partial<Activity>): Activity => ({
  id: "a1",
  user_id: "u1",
  type: "buy",
  symbol: "BTC",
  to_symbol: null,
  pct: null,
  meta: null,
  created_at: "2026-11-19T21:00:00Z",
  ...p,
});

describe("swap: tỷ lệ và số lượng gợi ý", () => {
  it("1 ETH = 13 SOL khi giá ETH gấp 13 lần SOL", () => {
    expect(swapRate(2600, 200)).toBeCloseTo(13, 6);
    expect(estimateReceive(1, 2600, 200)).toBeCloseTo(13, 6);
    expect(estimateReceive(0.5, 2600, 200)).toBeCloseTo(6.5, 6);
  });

  it("đổi sang USDT: tỷ lệ = giá token (USDT = 1)", () => {
    expect(swapRate(64000, 1)).toBe(64000);
    expect(estimateReceive(0.5, 64000, 1)).toBe(32000);
  });

  it("thiếu giá thì không gợi ý số (null), không bịa", () => {
    expect(swapRate(0, 200)).toBeNull();
    expect(swapRate(2600, 0)).toBeNull();
    expect(estimateReceive(1, 2600, 0)).toBeNull();
  });
});

describe("% hành động theo số lượng đang nắm trước giao dịch", () => {
  it("đang nắm 1 BTC, mua thêm 0,5 → 50%", () => {
    expect(actionPercent(0.5, 1)).toBe(50);
  });

  it("đổi/bán toàn bộ → 100%", () => {
    expect(actionPercent(1, 1)).toBe(100);
    expect(isFullPosition(100)).toBe(true);
    expect(isFullPosition(99.98)).toBe(true);
    expect(isFullPosition(50)).toBe(false);
  });

  it("mua lần đầu (chưa nắm gì) → null, không có mẫu số", () => {
    expect(actionPercent(0.5, 0)).toBeNull();
    expect(actionPercent(0.5, -1)).toBeNull();
  });

  it("làm tròn tối đa 1 chữ số thập phân", () => {
    expect(roundActionPercent(33.333)).toBe(33.3);
    expect(roundActionPercent(50)).toBe(50);
  });
});

describe("câu mô tả hành động: ngắn gọn, chỉ % và tên token", () => {
  it("mua thêm 50% BTC", () => {
    expect(activityLabel(act({ type: "buy", pct: 50 }))).toBe("Mua thêm");
    expect(activityDetail(act({ type: "buy", pct: 50 }))).toBe("50% BTC");
  });

  it("mua lần đầu: nhãn 'Mua', chi tiết chỉ tên token", () => {
    expect(activityLabel(act({ type: "buy", pct: null }))).toBe("Mua");
    expect(activityDetail(act({ type: "buy", pct: null }))).toBe("BTC");
  });

  it("đổi 100% BTC sang ETH", () => {
    expect(activityLabel(act({ type: "swap", pct: 100, to_symbol: "ETH" }))).toBe("Đổi");
    expect(activityDetail(act({ type: "swap", pct: 100, to_symbol: "ETH" }))).toBe(
      "100% BTC sang ETH",
    );
  });

  it("bán 100% BTC sang USDT", () => {
    expect(activityDetail(act({ type: "sell", pct: 100, to_symbol: "USDT" }))).toBe(
      "100% BTC sang USDT",
    );
  });

  it("đổi một phần 50% BTC sang ETH", () => {
    expect(activityDetail(act({ type: "swap", pct: 50, to_symbol: "ETH" }))).toBe(
      "50% BTC sang ETH",
    );
  });

  it("cập nhật portfolio: chi tiết là phân bổ mới", () => {
    const a = act({ type: "update", meta: { allocation: "ETH 81% · BTC 19%" } });
    expect(activityLabel(a)).toBe("Cập nhật portfolio");
    expect(activityDetail(a)).toBe("ETH 81% · BTC 19%");
  });

  it("tóm tắt phân bổ: làm tròn %", () => {
    expect(
      allocationSummary([
        { symbol: "ETH", percent: 80.95 },
        { symbol: "BTC", percent: 19.05 },
      ]),
    ).toBe("ETH 81% · BTC 19%");
  });
});
