import { COINS, normalizeSymbol } from "./coins";

/** Coin yêu thích ghim lên đầu bảng giá — tối đa 3, lưu trên thiết bị này. */
export const MAX_FAVORITES = 3;

/** Mặc định: BTC, ETH, Vàng. */
export const DEFAULT_FAVORITES = ["BTC", "ETH", "PAXG"] as const;

const KEY = "zth:favorite-coins";

function isKnown(symbol: string): boolean {
  return COINS.some((c) => c.symbol === normalizeSymbol(symbol));
}

function clean(list: readonly string[]): string[] {
  const out: string[] = [];
  for (const s of list) {
    const sym = normalizeSymbol(s);
    if (sym && isKnown(sym) && !out.includes(sym)) out.push(sym);
  }
  return out.slice(0, MAX_FAVORITES);
}

/** Đọc danh sách yêu thích; chưa lưu bao giờ thì trả về mặc định BTC/ETH/Vàng. Đã lưu rỗng (bỏ ghim hết) thì trả về rỗng, không tự về mặc định. */
export function loadFavorites(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [...DEFAULT_FAVORITES];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...DEFAULT_FAVORITES];
    return clean(parsed.map(String));
  } catch {
    return [...DEFAULT_FAVORITES];
  }
}

export function saveFavorites(list: readonly string[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(clean(list)));
  } catch {
    // Bỏ qua khi không ghi được storage (chế độ ẩn danh...).
  }
}

/**
 * Bật/tắt ghim một coin. Thêm quá 3 thì từ chối kèm thông báo để UI hiện toast.
 * Thứ tự ghim giữ nguyên thứ tự bấm (coin ghim sau nằm dưới coin ghim trước).
 */
export function toggleFavorite(
  symbol: string,
  current: readonly string[],
): { list: string[]; error?: string } {
  const sym = normalizeSymbol(symbol);
  if (!sym || !isKnown(sym)) return { list: [...current], error: "Coin không hỗ trợ." };
  const list = clean(current);
  if (list.includes(sym)) return { list: list.filter((s) => s !== sym) };
  if (list.length >= MAX_FAVORITES) {
    return { list, error: `Chỉ được ghim tối đa ${MAX_FAVORITES} coin yêu thích.` };
  }
  return { list: [...list, sym] };
}
