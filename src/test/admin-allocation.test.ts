import { beforeEach, describe, expect, it } from "vitest";
import {
  allocationChanged,
  buildAdminAllocationSlices,
  messageChanged,
  readFollowedInvestorId,
  saveFollowedInvestorId,
  selectPublishedAllocation,
  statsChanged,
  type AdminAllocation,
} from "@/lib/admin-allocation";
import type { AllocationSlice } from "@/lib/portfolio";

describe("admin allocation payload is percent-only", () => {
  it("keeps only symbol, name, percent and pnlPct (drops quantity/value/invested)", () => {
    const raw = [
      {
        symbol: "BTC",
        name: "Bitcoin",
        percent: 45.123,
        pnlPct: -12.346,
        quantity: 1.5,
        valueUsd: 90000,
        investedUsd: 80000,
        note: "secret",
      },
      { symbol: "ETH", name: "Ethereum", percent: 25, quantity: 10, valueUsd: 50000 },
    ] as unknown as AllocationSlice[];
    const out = buildAdminAllocationSlices(raw);
    expect(out).toEqual([
      { symbol: "BTC", name: "Bitcoin", percent: 45.12, pnlPct: -12.35 },
      { symbol: "ETH", name: "Ethereum", percent: 25, pnlPct: null },
    ]);
    for (const s of out) {
      expect(Object.keys(s).sort()).toEqual(["name", "percent", "pnlPct", "symbol"]);
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
  it("đổi khi lãi/lỗ % từng token lệch > 0.01, không đổi khi lệch ≤ 0.01", () => {
    const prev = [{ symbol: "BTC", name: "Bitcoin", percent: 45, pnlPct: -12.3 }];
    expect(
      allocationChanged(prev, [{ symbol: "BTC", name: "Bitcoin", percent: 45, pnlPct: -12.31 }]),
    ).toBe(false);
    expect(
      allocationChanged(prev, [{ symbol: "BTC", name: "Bitcoin", percent: 45, pnlPct: -12.32 }]),
    ).toBe(true);
    expect(
      allocationChanged(prev, [{ symbol: "BTC", name: "Bitcoin", percent: 45, pnlPct: null }]),
    ).toBe(true);
  });
});

describe("statsChanged", () => {
  it("không đổi khi ngày bắt đầu và lãi/lỗ giống nhau (lệch ≤ 0.01)", () => {
    const prev = { startedAt: "2025-01-02", pnlPct: 12.345 };
    expect(statsChanged(prev, { startedAt: "2025-01-02", pnlPct: 12.35 })).toBe(false);
  });
  it("đổi khi ngày bắt đầu khác hoặc lãi/lỗ lệch > 0.01", () => {
    const prev = { startedAt: "2025-01-02", pnlPct: 12.3 };
    expect(statsChanged(prev, { startedAt: "2025-02-01", pnlPct: 12.3 })).toBe(true);
    expect(statsChanged(prev, { startedAt: "2025-01-02", pnlPct: 12.5 })).toBe(true);
    expect(statsChanged(prev, { startedAt: "2025-01-02", pnlPct: -5 })).toBe(true);
    expect(statsChanged(null, { startedAt: "2025-01-02", pnlPct: 12.3 })).toBe(true);
  });
});

describe("messageChanged (lời nhắn của nhà đầu tư)", () => {
  it("null, rỗng và khoảng trắng coi như nhau", () => {
    expect(messageChanged(null, "")).toBe(false);
    expect(messageChanged("", "   ")).toBe(false);
    expect(messageChanged(undefined, null)).toBe(false);
  });
  it("bỏ qua khoảng trắng đầu/cuối khi so sánh", () => {
    expect(messageChanged("  Tích sản đều đặn  ", "Tích sản đều đặn")).toBe(false);
  });
  it("đổi khi nội dung khác, kể cả xóa lời nhắn", () => {
    expect(messageChanged(null, "Chào mọi người")).toBe(true);
    expect(messageChanged("Chào mọi người", "Tích sản đều đặn")).toBe(true);
    expect(messageChanged("Chào mọi người", "")).toBe(true);
    expect(messageChanged("Chào mọi người", null)).toBe(true);
  });
});

function fakeAllocation(user_id: string): AdminAllocation {
  return {
    user_id,
    slices: [{ symbol: "BTC", name: "Bitcoin", percent: 60 }],
    updated_at: "2026-11-17T10:00:00.000Z",
    startedAt: "2025-01-01",
    pnlPct: 12.5,
    message: null,
    messageUpdatedAt: null,
  };
}

/** localStorage thật trong môi trường test (jsdom dưới Bun) không đầy đủ nên
 *  dùng bản stub theo mẫu favorites.test.ts. */
function withStorage(entries: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(entries));
  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
      clear: () => {
        store.clear();
      },
    },
    configurable: true,
  });
}

describe("selectPublishedAllocation (chọn nhà đầu tư để xem)", () => {
  const admin = fakeAllocation("admin-1");
  const other = fakeAllocation("user-2");

  it("ưu tiên người đang theo dõi nếu còn trong danh sách", () => {
    expect(selectPublishedAllocation([admin, other], "user-2")).toBe(other);
  });

  it("chưa theo dõi ai thì xem người đầu tiên (mới cập nhật nhất)", () => {
    expect(selectPublishedAllocation([admin, other], null)).toBe(admin);
  });

  it("người theo dõi không còn trong danh sách thì về người đầu tiên", () => {
    expect(selectPublishedAllocation([admin], "user-2")).toBe(admin);
  });

  it("không có ai đăng thì null", () => {
    expect(selectPublishedAllocation([], "admin-1")).toBeNull();
    expect(selectPublishedAllocation([], null)).toBeNull();
  });
});

describe("followed investor (lưu trên thiết bị)", () => {
  beforeEach(() => {
    withStorage();
  });

  it("mặc định chưa theo dõi ai", () => {
    expect(readFollowedInvestorId()).toBeNull();
  });

  it("lưu rồi đọc lại được, gỡ thì về null", () => {
    saveFollowedInvestorId("admin-1");
    expect(readFollowedInvestorId()).toBe("admin-1");
    saveFollowedInvestorId(null);
    expect(readFollowedInvestorId()).toBeNull();
  });
});
