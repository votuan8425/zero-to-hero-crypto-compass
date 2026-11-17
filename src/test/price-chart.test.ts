import { describe, expect, it } from "vitest";
import { candleIsUp, clampPan, formatChartTime, formatSelectedTime, zoomVisibleCount } from "@/components/app/price-chart-dialog";
import { bucketPricesToCandles } from "@/lib/prices.functions";
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

describe("zoomVisibleCount (nút + / − đổi số nến hiển thị)", () => {
  it("phóng to thì ít nến hơn, thu nhỏ thì nhiều nến hơn, kẹp trong [8, tổng]", () => {
    expect(zoomVisibleCount(24, 72, "in")).toBe(17);
    expect(zoomVisibleCount(24, 72, "out")).toBe(34);
    expect(zoomVisibleCount(8, 72, "in")).toBe(8);
    expect(zoomVisibleCount(72, 72, "out")).toBe(72);
    expect(zoomVisibleCount(24, 20, "out")).toBe(20);
  });
});
