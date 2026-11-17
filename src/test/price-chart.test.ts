import { describe, expect, it } from "vitest";
import { columnUps } from "@/components/app/price-chart-dialog";

describe("columnUps (biểu đồ cột xanh/đỏ)", () => {
  it("xanh khi tăng, đỏ khi giảm so với kỳ trước", () => {
    expect(columnUps([100, 110, 105, 120])).toEqual([true, true, false, true]);
  });

  it("cột đầu tiên theo xu hướng chung (không có kỳ trước để so)", () => {
    expect(columnUps([100, 90, 80])).toEqual([false, false, false]);
    expect(columnUps([100, 100])).toEqual([true, true]);
  });

  it("rỗng thì rỗng", () => {
    expect(columnUps([])).toEqual([]);
  });
});
