import { describe, expect, it } from "vitest";
import {
  candleIsUp,
  clampPan,
  formatChartTime,
  formatSelectedTime,
  zoomVisibleCount,
} from "@/components/app/price-chart-dialog";
import { bucketPricesToCandles, metalRowsToCandles } from "@/lib/prices.functions";
import { fetchCandlesFromBrowser } from "@/lib/market-client";

describe("candleIsUp (nến xanh/đỏ)", () => {
  it("xanh khi đóng >= mở, đỏ khi đóng < mở", () => {
    expect(candleIsUp({ t: 0, o: 100, h: 110, l: 90, c: 105 })).toBe(true);
    expect(candleIsUp({ t: 0, o: 100, h: 110, l: 90, c: 95 })).toBe(false);
  });

  it("nến doji (đóng = mở) tính là xanh", () => {
    expect(candleIsUp({ t: 0, o: 100, h: 100, l: 100, c: 100 })).toBe(true);
  });
});

describe("bucketPricesToCandles (gom chuỗi giá thành nến OHLC)", () => {
  it("mở = giá đầu, đóng = giá cuối, cao/thấp = max/min trong khung", () => {
    const out = bucketPricesToCandles(
      [
        { t: 100, c: 10 },
        { t: 1100, c: 12 },
        { t: 1200, c: 9 },
        { t: 2100, c: 15 },
        { t: 2200, c: 14 },
      ],
      1000,
    );
    expect(out).toEqual([
      { t: 100, o: 10, h: 10, l: 10, c: 10 },
      { t: 1100, o: 12, h: 12, l: 9, c: 9 },
      { t: 2100, o: 15, h: 15, l: 14, c: 14 },
    ]);
  });

  it("sắp xếp theo thời gian trước khi gom (mở/đóng đúng thứ tự)", () => {
    const out = bucketPricesToCandles(
      [
        { t: 1200, c: 9 },
        { t: 100, c: 10 },
        { t: 1100, c: 12 },
      ],
      1000,
    );
    expect(out).toEqual([
      { t: 100, o: 10, h: 10, l: 10, c: 10 },
      { t: 1100, o: 12, h: 12, l: 9, c: 9 },
    ]);
  });

  it("bỏ điểm không hợp lệ (giá <= 0 hoặc không phải số)", () => {
    const out = bucketPricesToCandles(
      [
        { t: 100, c: 0 },
        { t: 200, c: NaN },
        { t: 1100, c: 5 },
      ],
      1000,
    );
    expect(out).toEqual([{ t: 1100, o: 5, h: 5, l: 5, c: 5 }]);
  });

  it("rỗng thì rỗng", () => {
    expect(bucketPricesToCandles([], 1000)).toEqual([]);
  });
});

describe("clampPan (kẹp độ lùi khi kéo chart)", () => {
  it("trong khoảng thì giữ nguyên, vượt thì kẹp về biên", () => {
    expect(clampPan(0, 72, 24)).toBe(0);
    expect(clampPan(10, 72, 24)).toBe(10);
    expect(clampPan(100, 72, 24)).toBe(48);
    expect(clampPan(-5, 72, 24)).toBe(0);
  });

  it("không đủ nến ngoài cửa sổ thì không kéo được", () => {
    expect(clampPan(5, 20, 24)).toBe(0);
    expect(clampPan(5, 52, 52)).toBe(0);
  });
});

describe("formatChartTime (nhãn thời gian dưới trục chart)", () => {
  const t = new Date(2026, 10, 17, 14, 30).getTime();

  it("Ngày → giờ:phút, Tháng → ngày/tháng, Năm → tháng/năm", () => {
    expect(formatChartTime(t, "1D")).toBe("14:30");
    expect(formatChartTime(t, "1M")).toBe("17/11");
    expect(formatChartTime(t, "1Y")).toBe("11/26");
  });
});

describe("formatSelectedTime (nhãn thời gian của nến đang chọn)", () => {
  const t = new Date(2026, 10, 17, 14, 30).getTime();

  it("Ngày → ngày/giờ, Tháng → ngày/tháng/năm, Năm → tháng/năm", () => {
    expect(formatSelectedTime(t, "1D")).toBe("17/11 14:30");
    expect(formatSelectedTime(t, "1M")).toBe("17/11/2026");
    expect(formatSelectedTime(t, "1Y")).toBe("11/2026");
  });
});

describe("fetchCandlesFromBrowser (dự phòng khi server không lấy được nến)", () => {
  it("coin không hỗ trợ thì báo lỗi ngay, không gọi mạng", async () => {
    const res = await fetchCandlesFromBrowser("XXX", "1D");
    expect(res.points).toEqual([]);
    expect(res.error).toBe("Coin không hỗ trợ.");
  });
});

describe("metalRowsToCandles (nến từ lịch sử giá SJC / Ancarat)", () => {
  // 2 mốc/ngày (06:00, 22:00): giá mua vào SJC tăng dần 13,20 → 13,32 Tr đ/chỉ.
  const rows = [
    { slotAt: "2026-11-18T06:00:00+07:00", bidVnd: 13_200_000, askVnd: 13_500_000 },
    { slotAt: "2026-11-18T22:00:00+07:00", bidVnd: 13_250_000, askVnd: 13_550_000 },
    { slotAt: "2026-11-19T06:00:00+07:00", bidVnd: 13_280_000, askVnd: 13_580_000 },
    { slotAt: "2026-11-19T22:00:00+07:00", bidVnd: 13_320_000, askVnd: 13_620_000 },
  ];

  it("1M: gom mốc thành nến ngày (mở = mốc đầu, đóng = mốc cuối trong ngày UTC)", () => {
    const out = metalRowsToCandles(rows, "1M");
    // Mốc 06:00 VN = 23:00 UTC hôm trước nên rơi sang ngày UTC trước:
    // 17/11: [13,20], 18/11: [13,25 → 13,28], 19/11: [13,32].
    expect(out).toHaveLength(3);
    expect(out[0]).toMatchObject({ o: 13_200_000, h: 13_200_000, l: 13_200_000, c: 13_200_000 });
    expect(out[1]).toMatchObject({ o: 13_250_000, h: 13_280_000, l: 13_250_000, c: 13_280_000 });
    expect(out[2]).toMatchObject({ o: 13_320_000, h: 13_320_000, l: 13_320_000, c: 13_320_000 });
  });

  it("1D: mỗi mốc một nến riêng, giá = giá mua vào SJC (không phải giá thế giới)", () => {
    const out = metalRowsToCandles(rows, "1D");
    expect(out).toHaveLength(4);
    expect(out.map((p) => p.c)).toEqual([13_200_000, 13_250_000, 13_280_000, 13_320_000]);
    // Nến cuối khớp đúng giá Mua vào SJC hiện tại, không phải ~11 Tr đ thế giới.
    expect(out[3]?.c).toBe(13_320_000);
  });

  it("rỗng thì rỗng (dialog hiện 'chưa đủ lịch sử' thay vì vẽ giá thế giới)", () => {
    expect(metalRowsToCandles([], "1M")).toEqual([]);
  });
});

describe("zoomVisibleCount (nút + / − đổi số nến hiển thị)", () => {
  it("phóng to thì ít nến hơn, thu nhỏ thì nhiều nến hơn, kẹp trong [8, tổng]", () => {
    expect(zoomVisibleCount(24, 72, "in")).toBe(17);
    expect(zoomVisibleCount(24, 72, "out")).toBe(34);
    expect(zoomVisibleCount(8, 72, "in")).toBe(8);
    expect(zoomVisibleCount(72, 72, "out")).toBe(72);
    expect(zoomVisibleCount(24, 20, "out")).toBe(20);
  });
});
