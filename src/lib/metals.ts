/**
 * Giá vàng / bạc trong nước (VND), tách riêng khỏi server function để dễ kiểm thử.
 *
 * - Vàng: theo SJC, loại "Vàng SJC 0.5 chỉ, 1 chỉ, 2 chỉ". SJC niêm yết theo
 *   lượng nên chia 10 để ra giá mỗi chỉ (1 lượng = 10 chỉ).
 * - Bạc: theo Ancarat, sản phẩm "Ngân Long Quảng Tiến 999 - 1 lượng", giá mỗi lượng.
 *
 * "Bán ra" là giá cửa hàng bán cho mình (dùng khi ghi lần mua);
 * "Mua vào" là giá cửa hàng mua lại (dùng để định giá tài sản đang giữ).
 */

export interface MetalQuote {
  /** Giá cửa hàng mua lại, VND mỗi đơn vị (chỉ / lượng). */
  bidVnd: number;
  /** Giá cửa hàng bán ra, VND mỗi đơn vị (chỉ / lượng). */
  askVnd: number;
  /** % thay đổi giá mua vào so với lần niêm yết trước, null nếu không có. */
  change24h: number | null;
  /** Nguồn hiển thị cho người dùng. */
  source: string;
}

export const CHI_PER_LUONG = 10;

interface SjcRow {
  Id?: number;
  TypeName?: string;
  BuyValue?: number;
  SellValue?: number;
  BuyDifferValue?: number | null;
}

/** Đọc giá vàng SJC (theo lượng) → giá mỗi chỉ. Ưu tiên loại 1 chỉ, không có thì dùng miếng 1 lượng. */
export function parseSjcGold(json: unknown): MetalQuote | null {
  const rows = ((json as { data?: SjcRow[] })?.data ?? []).filter(
    (r) => Number(r.BuyValue) > 0 && Number(r.SellValue) > 0,
  );
  const pick =
    rows.find((r) => /^Vàng SJC/i.test(r.TypeName ?? "") && /\b1 chỉ/i.test(r.TypeName ?? "")) ??
    rows.find((r) => r.Id === 1) ??
    rows.find((r) => /^Vàng SJC/i.test(r.TypeName ?? ""));
  if (!pick) return null;
  const buy = Number(pick.BuyValue);
  const sell = Number(pick.SellValue);
  const diff = Number(pick.BuyDifferValue ?? 0);
  const prev = buy - diff;
  return {
    bidVnd: buy / CHI_PER_LUONG,
    askVnd: sell / CHI_PER_LUONG,
    change24h: Number.isFinite(diff) && prev > 0 ? (diff / prev) * 100 : null,
    source: "SJC",
  };
}

/** Dự phòng khi trang SJC chặn: bảng giá PNJ có dòng "Vàng miếng SJC", đơn vị nghìn đồng / chỉ. */
export function parsePnjSjc(json: unknown): MetalQuote | null {
  const rows = (json as { data?: { masp?: string; giaban?: number; giamua?: number }[] })?.data ?? [];
  const r = rows.find((x) => x.masp === "SJC");
  const sell = Number(r?.giaban);
  const buy = Number(r?.giamua);
  if (!(sell > 0) || !(buy > 0)) return null;
  return { bidVnd: buy * 1000, askVnd: sell * 1000, change24h: null, source: "SJC" };
}

const toNumber = (s: string) => Number(s.replace(/[^\d]/g, ""));

/** Đọc bảng giá bạc Ancarat (HTML): cột BÁN RA trước, MUA VÀO sau, giá mỗi lượng. */
export function parseAncaratSilver(html: string): MetalQuote | null {
  const re =
    /Ngân Long Quảng Tiến 999 - 1 lượng\s*<\/a>\s*<\/td>\s*<td[^>]*>\s*([\d.,]+)\s*<\/td>\s*<td[^>]*>\s*([\d.,]+)\s*<\/td>/i;
  const m = html.match(re);
  if (!m) return null;
  const sell = toNumber(m[1] ?? "");
  const buy = toNumber(m[2] ?? "");
  if (!(sell > 0) || !(buy > 0)) return null;
  return { bidVnd: buy, askVnd: sell, change24h: null, source: "Ancarat" };
}
