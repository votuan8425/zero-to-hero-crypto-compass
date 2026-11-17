import { describe, expect, it } from "vitest";
import { formatMoney, normalizeCurrency } from "@/lib/format";
import { convertUsd } from "@/hooks/use-app-data";

describe("normalizeCurrency", () => {
  it("tài khoản cũ lưu USD thì hiểu là USDT", () => {
    expect(normalizeCurrency("USD")).toBe("USDT");
  });
  it("USDT và KRW giữ nguyên, giá trị lạ về VND", () => {
    expect(normalizeCurrency("USDT")).toBe("USDT");
    expect(normalizeCurrency("KRW")).toBe("KRW");
    expect(normalizeCurrency(null)).toBe("VND");
    expect(normalizeCurrency("EUR")).toBe("VND");
  });
});

describe("formatMoney", () => {
  it("USDT hiển thị kiểu app crypto, giá trị như USD", () => {
    expect(formatMoney(64444, "USDT")).toBe("64.444,00 USDT");
    expect(formatMoney(0.5, "USDT")).toBe("0,50 USDT");
  });
  it("KRW không thập phân, ký hiệu ₩", () => {
    expect(formatMoney(89000000, "KRW")).toBe("89.000.000 ₩");
    expect(formatMoney(1500000, "KRW", { compact: true })).toContain("₩");
  });
  it("VND giữ nguyên như trước", () => {
    expect(formatMoney(26000000, "VND")).toBe("26.000.000 ₫");
  });
});

describe("convertUsd", () => {
  it("USDT trả nguyên giá USD", () => {
    expect(convertUsd(100, "USDT", 26000, 1380)).toBe(100);
  });
  it("VND và KRW nhân đúng tỷ giá, thiếu tỷ giá thì null", () => {
    expect(convertUsd(100, "VND", 26000, 1380)).toBe(2600000);
    expect(convertUsd(100, "KRW", 26000, 1380)).toBe(138000);
    expect(convertUsd(100, "KRW", 26000, null)).toBeNull();
    expect(convertUsd(null, "VND", 26000, 1380)).toBeNull();
  });
});
