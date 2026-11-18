import type { PriceMap } from "./portfolio";
import type { PricesResult } from "./prices.functions";

/** Quy tắc giá vàng/bạc — hằng số ký hiệu vàng/bạc nằm ngay dưới đây. */

/**
 * Vàng: PAXG trên OKX làm proxy (1 PAXG ≈ 1 ounce vàng). Nằm trong COINS
 * nên xuất hiện trong danh sách chọn khi thêm lần mua, ngay sau ETH.
 */
export const GOLD_SYMBOL = "PAXG";

/**
 * Bạc: KAG (Kinesis Silver) trên CoinGecko làm proxy (1 KAG ≈ 1 ounce bạc).
 * OKX không có cặp bạc nào (đã kiểm chứng 2026-11-17: không có XAG/KAG/SLV
 * trong bảng tickers SPOT), nên bạc chỉ lấy từ CoinGecko, không qua OKX.
 */
export const SILVER_SYMBOL = "KAG";

/**
 * Quy tắc giá vàng/bạc (toàn app, không chỉ mục Giá thị trường):
 * - Luôn hiển thị bằng VND, bất kể tiền tệ hiển thị đã chọn.
 * - Chỉ cập nhật 2 lần/ngày, lúc 6h sáng và 22h tối (giờ Việt Nam).
 *   Giữa 2 khung giờ thì mọi chỗ hiển thị đều dùng giá đã chốt ở khung trước.
 */

export function isMetalSymbol(symbol: string): boolean {
  return symbol === GOLD_SYMBOL || symbol === SILVER_SYMBOL;
}

/**
 * Khung giờ chốt giá vàng/bạc gần nhất, dạng "2026-11-18-06" hoặc
 * "2026-11-18-22" (ngày + giờ theo Asia/Ho_Chi_Minh).
 * Trước 6h sáng thì khung là 22h hôm trước; từ 6h đến trước 22h là khung 6h.
 */
export function currentMetalsSlot(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const year = Number(get("year"));
  const month = Number(get("month"));
  const day = Number(get("day"));
  const hour = Number(get("hour"));
  const slotHour = hour < 6 ? "22" : hour < 22 ? "06" : "22";
  // Trước 6h sáng: khung 22h thuộc ngày hôm trước (theo lịch giờ VN).
  const d = new Date(Date.UTC(year, month - 1, day));
  if (hour < 6) d.setUTCDate(d.getUTCDate() - 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}-${slotHour}`;
}

/**
 * Từ giá last + % chênh lệch mua/bán của sàn → giá mua vào (bid, thấp hơn)
 * và giá bán ra (ask, cao hơn). Dùng cho bạc vì CoinGecko tickers chỉ cho
 * % spread, không cho sẵn giá bid/ask.
 */
export function deriveBidAsk(last: number, spreadPct: number): { bid: number; ask: number } {
  const half = spreadPct / 200;
  return { bid: last * (1 - half), ask: last * (1 + half) };
}

const METALS_CACHE = "zth:metals";

interface MetalsCache {
  slot: string;
  quotes: Partial<PriceMap>;
}

function readMetalsCache(): MetalsCache | null {
  try {
    const raw = localStorage.getItem(METALS_CACHE);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MetalsCache;
    return parsed && typeof parsed.slot === "string" && parsed.quotes ? parsed : null;
  } catch {
    return null;
  }
}

function writeMetalsCache(value: MetalsCache): void {
  try {
    localStorage.setItem(METALS_CACHE, JSON.stringify(value));
  } catch {
    // Bộ nhớ đầy/khóa: lần tải sau sẽ chốt lại khung mới, không chặn giá coin.
  }
}

/**
 * Vàng/bạc chỉ chốt giá mới vào 2 khung 6h/22h: nếu vẫn trong khung cũ thì
 * giữ nguyên giá đã chốt (kể cả khi server vừa trả giá mới hơn); sang khung
 * mới thì lưu giá vừa tải làm giá chốt của khung đó. Các coin khác không đổi.
 */
export function applyMetalsFreeze(res: PricesResult): PricesResult {
  const slot = currentMetalsSlot();
  const stored = readMetalsCache();
  if (stored && stored.slot === slot) {
    return { ...res, prices: { ...res.prices, ...stored.quotes } };
  }
  const quotes: Partial<PriceMap> = {};
  for (const sym of [GOLD_SYMBOL, SILVER_SYMBOL]) {
    const q = res.prices[sym];
    if (q) quotes[sym] = q;
  }
  if (Object.keys(quotes).length > 0) writeMetalsCache({ slot, quotes });
  return res;
}
