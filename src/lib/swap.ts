/** Toán swap và % hành động theo số lượng đang nắm trước giao dịch. */

/** Tỷ lệ: 1 token A đổi được bao nhiêu token B (theo giá live). */
export function swapRate(priceA: number, priceB: number): number | null {
  if (!(priceA > 0) || !(priceB > 0)) return null;
  return priceA / priceB;
}

/** Số lượng B nhận được (ước tính) khi đổi amountA token A. */
export function estimateReceive(amountA: number, priceA: number, priceB: number): number | null {
  const r = swapRate(priceA, priceB);
  return r == null ? null : amountA * r;
}

/**
 * % của một hành động so với số lượng đang nắm TRƯỚC giao dịch.
 * Ví dụ: đang nắm 1 BTC, mua thêm 0,5 → 50%. Đổi/bán toàn bộ → 100%.
 * Trả null khi chưa nắm gì trước đó (mua lần đầu — không có mẫu số để tính %).
 */
export function actionPercent(amount: number, heldBefore: number): number | null {
  if (!(amount > 0) || !(heldBefore > 0)) return null;
  return (amount / heldBefore) * 100;
}

/** Làm tròn % để hiển thị và lưu log: tối đa 1 chữ số thập phân. */
export function roundActionPercent(pct: number): number {
  return Math.round(pct * 10) / 10;
}

/** % đã đổi/bán có phải toàn bộ số đang nắm không (cho phép sai số làm tròn). */
export function isFullPosition(pct: number | null): boolean {
  return pct != null && Math.abs(pct - 100) < 0.05;
}
