import { describe, expect, it } from "vitest";
import { COINS, coinName, displaySymbol, getCoin, quantityUnit } from "@/lib/coins";
import { metalSlotAt, parseAncaratSilver, parsePnjSjc, parseSjcGold } from "@/lib/metals";
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

  it("vàng mua theo chỉ, bạc mua theo lượng", () => {
    expect(getCoin("PAXG")?.unit).toBe("chỉ");
    expect(getCoin("KAG")?.unit).toBe("lượng");
    expect(getCoin("BTC")?.unit).toBeUndefined();
    expect(quantityUnit("PAXG")).toBe("chỉ");
    expect(quantityUnit("KAG")).toBe("lượng");
    expect(quantityUnit("BTC")).toBe("BTC");
  });

  it("vàng hiển thị nguồn SJC, bạc hiển thị nguồn Ancarat", () => {
    expect(displaySymbol("PAXG")).toBe("SJC");
    expect(displaySymbol("KAG")).toBe("Ancarat");
  });
});

describe("giá trị danh mục của vàng và bạc", () => {
  const prices = {
    PAXG: { usd: 3900, vnd: 0, krw: 0, change24h: 1 },
    KAG: { usd: 47.78, vnd: 0, krw: 0, change24h: 0.3 },
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

describe("giá vàng SJC và bạc Ancarat", () => {
  const sjc = {
    success: true,
    data: [
      { Id: 1, TypeName: "Vàng SJC 1L, 10L, 1KG", BuyValue: 134200000, SellValue: 137200000, BuyDifferValue: 0 },
      { Id: 33, TypeName: "Vàng SJC 0.5 chỉ, 1 chỉ, 2 chỉ", BuyValue: 134200000, SellValue: 137230000, BuyDifferValue: 0 },
      { Id: 49, TypeName: "Vàng nhẫn SJC 99,99% 1 chỉ, 2 chỉ, 5 chỉ", BuyValue: 133000000, SellValue: 137000000, BuyDifferValue: 0 },
    ],
  };

  it("vàng SJC: lấy loại 1 chỉ, đổi giá mỗi lượng thành giá mỗi chỉ (chia 10)", () => {
    const q = parseSjcGold(sjc);
    expect(q?.bidVnd).toBe(13420000);
    expect(q?.askVnd).toBe(13723000);
    expect(q?.source).toBe("SJC");
  });

  it("vàng SJC: không có loại 1 chỉ thì dùng miếng 1 lượng", () => {
    const q = parseSjcGold({ data: [sjc.data[0], sjc.data[2]] });
    expect(q?.askVnd).toBe(13720000);
  });

  it("dự phòng PNJ: dòng vàng miếng SJC tính nghìn đồng mỗi chỉ", () => {
    const q = parsePnjSjc({ data: [{ masp: "SJC", giaban: 13720, giamua: 13420 }] });
    expect(q?.askVnd).toBe(13720000);
    expect(q?.bidVnd).toBe(13420000);
  });

  it("bạc Ancarat: bán ra trước, mua vào sau, giá mỗi lượng", () => {
    const html =
      '<td><a href="x">Ngân Long Quảng Tiến 999 - 1 lượng</a></td><td class="a">1,598,000</td><td class="b">1,545,000</td>';
    const q = parseAncaratSilver(html);
    expect(q?.askVnd).toBe(1598000);
    expect(q?.bidVnd).toBe(1545000);
    expect(q?.source).toBe("Ancarat");
  });

  it("không đọc được thì không bịa giá", () => {
    expect(parseSjcGold({ data: [] })).toBeNull();
    expect(parseAncaratSilver("<html></html>")).toBeNull();
    expect(parsePnjSjc({ data: [] })).toBeNull();
  });
});

describe("giá vàng bạc chỉ cập nhật lúc 6:00 và 22:00 giờ Việt Nam", () => {
  // Giờ Việt Nam = UTC+7: 06:00 VN = 23:00 UTC hôm trước, 22:00 VN = 15:00 UTC.
  it("13:44 giờ VN vẫn dùng giá mốc 06:00 sáng cùng ngày", () => {
    const slot = metalSlotAt(new Date("2026-11-18T06:44:00Z"));
    expect(slot.toISOString()).toBe("2026-11-17T23:00:00.000Z");
  });

  it("đúng 22:00 giờ VN chuyển sang mốc 22:00", () => {
    expect(metalSlotAt(new Date("2026-11-18T15:00:00Z")).toISOString()).toBe(
      "2026-11-18T15:00:00.000Z",
    );
  });

  it("21:59 giờ VN vẫn là mốc 06:00", () => {
    expect(metalSlotAt(new Date("2026-11-18T14:59:00Z")).toISOString()).toBe(
      "2026-11-17T23:00:00.000Z",
    );
  });

  it("03:00 sáng giờ VN dùng mốc 22:00 tối hôm trước", () => {
    // 03:00 VN ngày 19 = 20:00 UTC ngày 18.
    expect(metalSlotAt(new Date("2026-11-18T20:00:00Z")).toISOString()).toBe(
      "2026-11-18T15:00:00.000Z",
    );
  });
});

describe("vàng bạc luôn tính bằng VND", () => {
  it("vốn và lãi/lỗ VND không đổi theo tỷ giá", () => {
    const holdings = computeHoldings(
      [
        tx({
          symbol: "PAXG",
          coin_name: "Vàng",
          quantity: 2,
          price_usd: 520,
          price_vnd: 13_723_000,
          fee_vnd: 0,
        }),
      ],
      { PAXG: { usd: 510, vnd: 13_420_000, krw: 0, change24h: null, askVnd: 13_723_000 } },
    );
    const g = holdings[0];
    expect(g?.investedVnd).toBe(27_446_000);
    expect(g?.avgCostVnd).toBe(13_723_000);
    expect(g?.valueVnd).toBe(26_840_000);
    expect(g?.pnlVnd).toBe(-606_000);
  });

  it("lần mua cũ không có giá VND thì không bịa vốn VND", () => {
    const holdings = computeHoldings(
      [tx({ symbol: "KAG", coin_name: "Bạc", quantity: 1, price_usd: 60 })],
      { KAG: { usd: 59, vnd: 1_545_000, krw: 0, change24h: null } },
    );
    expect(holdings[0]?.investedVnd).toBeNull();
    expect(holdings[0]?.valueVnd).toBe(1_545_000);
  });
});
