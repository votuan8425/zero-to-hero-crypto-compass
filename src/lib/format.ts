export type Currency = "VND" | "USDT" | "KRW";

/** Các đơn vị tiền tệ hiển thị — giá niêm yết theo USDT như các app crypto (OKX, BNB). */
export const CURRENCY_OPTIONS: { value: Currency; label: string }[] = [
  { value: "VND", label: "Việt Nam Đồng (₫)" },
  { value: "USDT", label: "USDT" },
  { value: "KRW", label: "Won Hàn Quốc (₩)" },
];

/** Tài khoản cũ lưu "USD" thì hiểu là USDT (1 USDT ≈ 1 USD). */
export function normalizeCurrency(value: string | null | undefined): Currency {
  if (value === "USDT" || value === "KRW") return value;
  if (value === "USD") return "USDT";
  return "VND";
}

export const LOCALE = "vi-VN";
export const TIME_ZONE = "Asia/Ho_Chi_Minh";

export function formatMoney(
  value: number | null | undefined,
  currency: Currency,
  opts: { compact?: boolean } = {},
): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (currency === "VND" || currency === "KRW") {
    const symbol = currency === "VND" ? "₫" : "₩";
    if (opts.compact && Math.abs(value) >= 1_000_000) {
      return (
        new Intl.NumberFormat(LOCALE, { notation: "compact", maximumFractionDigits: 2 }).format(
          value,
        ) + ` ${symbol}`
      );
    }
    return new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 }).format(value) + ` ${symbol}`;
  }
  // USDT: giá trị như USD (1 USDT ≈ 1 USD), hiển thị kiểu app crypto.
  const digits = Math.abs(value) < 1 && value !== 0 ? 4 : 2;
  return (
    new Intl.NumberFormat(LOCALE, {
      minimumFractionDigits: 2,
      maximumFractionDigits: digits,
      notation: opts.compact && Math.abs(value) >= 1_000_000 ? "compact" : "standard",
    }).format(value) + " USDT"
  );
}

export function formatNumber(value: number | null | undefined, maxDigits = 8): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(LOCALE, { maximumFractionDigits: maxDigits }).format(value);
}

export function formatPercent(
  value: number | null | undefined,
  digits = 2,
  signed = false,
): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const s = new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value);
  return `${signed && value > 0 ? "+" : ""}${s}%`;
}

export function formatDate(value: string | Date, style: "short" | "long" = "short"): string {
  const d = typeof value === "string" ? parseDateOnly(value) : value;
  return new Intl.DateTimeFormat(
    LOCALE,
    style === "long"
      ? { weekday: "long", day: "numeric", month: "long", year: "numeric" }
      : { day: "2-digit", month: "2-digit", year: "numeric" },
  ).format(d);
}

export function formatDateTime(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(LOCALE, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  }).format(d);
}

/** Parses YYYY-MM-DD as a local calendar date (no UTC shift). */
export function parseDateOnly(value: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return new Date(value);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayKey(): string {
  return toDateKey(new Date());
}
