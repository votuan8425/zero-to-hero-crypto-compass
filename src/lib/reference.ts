import { normalizeSymbol, OTHER_SYMBOL } from "./coins";

/** Where a number came from: read off the image, calculated by AI from other visible numbers, or not found. */
export type DataSource = "extracted" | "computed" | "unknown";

export interface RefHolding {
  symbol: string;
  name: string | null;
  percent: number | null;
  percent_source: DataSource;
  quantity: number | null;
  value: number | null;
  value_currency: string | null;
  confidence: "high" | "medium" | "low";
}

export const PERCENT_TOLERANCE = 0.5;

export interface PercentCheck {
  total: number;
  diff: number;
  ok: boolean;
  missing: number;
}

/** Checks whether known percentages add up to 100% (±0.5). */
export function checkPercentSum(holdings: Pick<RefHolding, "percent">[]): PercentCheck {
  const known = holdings.filter((h) => h.percent != null && Number.isFinite(h.percent));
  const total = Math.round(known.reduce((s, h) => s + Number(h.percent), 0) * 100) / 100;
  const diff = Math.round((100 - total) * 100) / 100;
  return { total, diff, ok: Math.abs(diff) <= PERCENT_TOLERANCE && known.length === holdings.length && holdings.length > 0, missing: holdings.length - known.length };
}

/**
 * Fills missing percentages from visible values only when every row has a value.
 * Filled rows are marked "computed" — never invented.
 */
export function fillPercentFromValues(holdings: RefHolding[]): RefHolding[] {
  const needs = holdings.some((h) => h.percent == null);
  const allValues = holdings.length > 0 && holdings.every((h) => h.value != null && h.value >= 0);
  if (!needs || !allValues) return holdings;
  const total = holdings.reduce((s, h) => s + (h.value ?? 0), 0);
  if (total <= 0) return holdings;
  return holdings.map((h) => h.percent != null ? h : { ...h, percent: Math.round(((h.value ?? 0) / total) * 10000) / 100, percent_source: "computed" });
}

/** Merges duplicate symbols and normalizes symbol casing. */
export function normalizeHoldings(holdings: RefHolding[]): RefHolding[] {
  const map = new Map<string, RefHolding>();
  for (const h of holdings) {
    const symbol = normalizeSymbol(h.symbol);
    if (!symbol) continue;
    const prev = map.get(symbol);
    if (!prev) { map.set(symbol, { ...h, symbol }); continue; }
    map.set(symbol, {
      ...prev,
      percent: prev.percent != null && h.percent != null ? prev.percent + h.percent : prev.percent ?? h.percent,
      quantity: prev.quantity != null && h.quantity != null ? prev.quantity + h.quantity : prev.quantity ?? h.quantity,
      value: prev.value != null && h.value != null ? prev.value + h.value : prev.value ?? h.value,
    });
  }
  return [...map.values()].sort((a, b) => (b.percent ?? -1) - (a.percent ?? -1));
}

export interface Concentration {
  count: number;
  top1: { symbol: string; percent: number } | null;
  top3Percent: number;
  hhi: number;
  level: "rat-tap-trung" | "tap-trung" | "can-bang" | "da-dang";
  label: string;
}

/** Concentration analysis using top holdings and the Herfindahl-Hirschman index (0–10 000). */
export function analyzeConcentration(items: { symbol: string; percent: number | null }[]): Concentration {
  const known = items.filter((i) => i.percent != null && i.percent > 0).map((i) => ({ symbol: i.symbol, percent: Number(i.percent) })).sort((a, b) => b.percent - a.percent);
  const coins = known.filter((k) => k.symbol !== OTHER_SYMBOL);
  const hhi = Math.round(known.reduce((s, k) => s + k.percent * k.percent, 0));
  const top3Percent = Math.round(known.slice(0, 3).reduce((s, k) => s + k.percent, 0) * 100) / 100;
  const level: Concentration["level"] = hhi >= 5000 ? "rat-tap-trung" : hhi >= 2500 ? "tap-trung" : hhi >= 1500 ? "can-bang" : "da-dang";
  const label = { "rat-tap-trung": "Rất tập trung", "tap-trung": "Tập trung", "can-bang": "Cân bằng", "da-dang": "Đa dạng" }[level];
  return { count: coins.length, top1: known[0] ?? null, top3Percent, hhi, level, label };
}

export interface CompareRow {
  symbol: string;
  mine: number;
  reference: number;
  diff: number;
}

/** Side-by-side allocation table; informational only. */
export function compareAllocations(mine: { symbol: string; percent: number }[], reference: { symbol: string; percent: number | null }[]): CompareRow[] {
  const symbols = new Set([...mine.map((m) => normalizeSymbol(m.symbol)), ...reference.map((r) => normalizeSymbol(r.symbol))]);
  const get = (list: { symbol: string; percent: number | null }[], s: string) => list.filter((x) => normalizeSymbol(x.symbol) === s).reduce((a, x) => a + (x.percent ?? 0), 0);
  return [...symbols].map((s) => {
    const m = Math.round(get(mine, s) * 100) / 100;
    const r = Math.round(get(reference, s) * 100) / 100;
    return { symbol: s, mine: m, reference: r, diff: Math.round((m - r) * 100) / 100 };
  }).sort((a, b) => Math.max(b.mine, b.reference) - Math.max(a.mine, a.reference));
}

export const SOURCE_LABEL: Record<DataSource, string> = {
  extracted: "Trích xuất từ ảnh",
  computed: "AI ước tính",
  unknown: "Không xác định",
};
