import { useId, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CoinLogo } from "./coin-logo";
import { PnlText } from "./stat";
import { getCoin } from "@/lib/coins";
import { getCandles, type ChartRange } from "@/lib/prices.functions";
import { formatNumber, type Currency } from "@/lib/format";
import { cn } from "@/lib/utils";

const RANGES: { value: ChartRange; label: string }[] = [
  { value: "1D", label: "Ngày" },
  { value: "1M", label: "Tháng" },
  { value: "1Y", label: "Năm" },
];

const W = 560;
const H = 200;
const PAD = 10;
const LABEL_W = 84; // Gutter phải cho mốc giá.

/** Popup biểu đồ giá theo ngày / tháng / năm — kiểu OKX, dùng chung Dialog với "Thêm lần mua". */
export function PriceChartDialog({
  open,
  onOpenChange,
  symbol,
  money,
  currency,
  usdVnd,
  usdKrw,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  symbol: string | null;
  money: (usd: number | null, compact?: boolean) => string;
  currency: Currency;
  usdVnd: number | null;
  usdKrw: number | null;
}) {
  const [range, setRange] = useState<ChartRange>("1D");
  const gradientId = useId();
  const coin = symbol ? getCoin(symbol) : undefined;
  const candles = useQuery({
    queryKey: ["candles", symbol, range],
    queryFn: () => getCandles({ data: { symbol: symbol ?? "", range } }),
    enabled: open && !!symbol,
    staleTime: 60_000,
  });
  const points = candles.data?.points ?? [];
  const chart = useMemo(() => {
    if (points.length < 2) return null;
    const values = points.map((p) => p.c);
    let rawMin = Math.min(...values);
    let rawMax = Math.max(...values);
    if (rawMax === rawMin) {
      rawMin = rawMax * 0.999;
      rawMax = rawMax * 1.001;
    }
    const pad = (rawMax - rawMin) * 0.08;
    const min = rawMin - pad;
    const max = rawMax + pad;
    const x = (i: number) =>
      PAD + (i / (points.length - 1)) * (W - PAD * 2 - LABEL_W);
    const y = (v: number) => PAD + (1 - (v - min) / (max - min)) * (H - PAD * 2);
    const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.c).toFixed(1)}`).join(" ");
    const area = `${line} L${x(points.length - 1).toFixed(1)},${H} L${x(0).toFixed(1)},${H} Z`;
    const last = points[points.length - 1];
    // Mốc giá theo dữ liệu thật (cao nhất → thấp nhất), hiển thị ở trục phải.
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => {
      const value = rawMax - f * (rawMax - rawMin);
      return { value, y: y(value) };
    });
    return {
      line,
      area,
      lastX: last ? x(points.length - 1) : 0,
      lastY: last ? y(last.c) : 0,
      ticks,
    };
  }, [points]);
  const change = candles.data?.changePct ?? null;
  const up = (change ?? 0) >= 0;
  const lastPrice = points.length > 0 ? (points[points.length - 1]?.c ?? null) : null;
  const high = points.length > 0 ? Math.max(...points.map((p) => p.c)) : null;
  const low = points.length > 0 ? Math.min(...points.map((p) => p.c)) : null;
  const unit = coin?.unit === "ounce" ? " / ounce" : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            {symbol && <CoinLogo symbol={symbol} size={28} />}
            <span>
              {coin?.name ?? symbol}
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {symbol}
                {unit}
              </span>
            </span>
          </DialogTitle>
          <DialogDescription>Biểu đồ giá từ OKX (Bạc từ CoinGecko).</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="num text-2xl font-bold tracking-tight">
              {lastPrice != null ? money(lastPrice) : "—"}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {range === "1D" ? "24 giờ qua" : range === "1M" ? "30 ngày qua" : "52 tuần qua"}
              {currency === "VND" && usdVnd
                ? ` · 1 USDT ≈ ${formatNumber(usdVnd, 0)} ₫`
                : currency === "KRW" && usdKrw
                  ? ` · 1 USDT ≈ ${formatNumber(usdKrw, 0)} ₩`
                  : ""}
            </div>
          </div>
          <div className="text-right">
            <PnlText value={change} className="text-lg font-semibold">
              {change != null ? `${change >= 0 ? "+" : ""}${formatNumber(change, 2)}%` : "—"}
            </PnlText>
            <ToggleGroup
              type="single"
              value={range}
              onValueChange={(v) => v && setRange(v as ChartRange)}
              className="mt-1.5 justify-end"
            >
              {RANGES.map((r) => (
                <ToggleGroupItem key={r.value} value={r.value} className="h-7 px-3 text-xs">
                  {r.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </div>

        <div className="relative">
          {candles.isLoading ? (
            <div className="grid h-[200px] place-items-center text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Đang tải biểu đồ…
              </span>
            </div>
          ) : candles.data?.error || !chart ? (
            <div className="grid h-[200px] place-items-center px-6 text-center text-sm text-muted-foreground">
              {candles.data?.error ?? "Chưa có dữ liệu biểu đồ cho coin này."}
            </div>
          ) : (
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="h-[200px] w-full"
              role="img"
              aria-label={`Biểu đồ giá ${coin?.name ?? symbol}`}
            >
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={up ? "var(--gain)" : "var(--loss)"} stopOpacity="0.35" />
                  <stop offset="100%" stopColor={up ? "var(--gain)" : "var(--loss)"} stopOpacity="0" />
                </linearGradient>
              </defs>
              {chart.ticks.map((t) => (
                <g key={t.value}>
                  <line
                    x1={PAD}
                    x2={W - PAD - LABEL_W}
                    y1={t.y}
                    y2={t.y}
                    stroke="var(--border)"
                    strokeDasharray="3 5"
                    strokeWidth="1"
                  />
                  <text
                    x={W - 6}
                    y={t.y + 4}
                    textAnchor="end"
                    fontSize="11"
                    fill="var(--muted-foreground)"
                  >
                    {money(t.value, currency !== "USDT")}
                  </text>
                </g>
              ))}
              <path d={chart.area} fill={`url(#${gradientId})`} />
              <path
                d={chart.line}
                fill="none"
                stroke={up ? "var(--gain)" : "var(--loss)"}
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <circle cx={chart.lastX} cy={chart.lastY} r="4" fill={up ? "var(--gain)" : "var(--loss)"} />
              <circle cx={chart.lastX} cy={chart.lastY} r="8" fill={up ? "var(--gain)" : "var(--loss)"} opacity="0.25" />
            </svg>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-surface-raised px-2 py-2.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Cao nhất
            </div>
            <div className="num mt-0.5 text-sm font-semibold">{high != null ? money(high) : "—"}</div>
          </div>
          <div className="rounded-lg bg-surface-raised px-2 py-2.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Thấp nhất
            </div>
            <div className="num mt-0.5 text-sm font-semibold">{low != null ? money(low) : "—"}</div>
          </div>
          <div className="rounded-lg bg-surface-raised px-2 py-2.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Thay đổi
            </div>
            <PnlText value={change} className={cn("mt-0.5 block text-sm font-semibold")}>
              {change != null ? `${change >= 0 ? "+" : ""}${formatNumber(change, 2)}%` : "—"}
            </PnlText>
          </div>
        </div>
        <p className="text-center text-xs text-muted-foreground">
          Giá chỉ mang tính tham khảo, không phải khuyến nghị đầu tư.
        </p>
      </DialogContent>
    </Dialog>
  );
}
