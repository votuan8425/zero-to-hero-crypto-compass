import { useEffect, useId, useMemo, useRef, useState } from "react";
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
import {
  CHART_VISIBLE_COUNT,
  getCandles,
  type CandlePoint,
  type ChartRange,
} from "@/lib/prices.functions";
import { formatNumber, type Currency } from "@/lib/format";
import { cn } from "@/lib/utils";

const RANGES: { value: ChartRange; label: string }[] = [
  { value: "1D", label: "Ngày" },
  { value: "1M", label: "Tháng" },
  { value: "1Y", label: "Năm" },
];

/** Nến tăng (xanh) khi đóng >= mở, giảm (đỏ) khi đóng < mở. */
export function candleIsUp(p: CandlePoint): boolean {
  return p.c >= p.o;
}

/** Kẹp độ lùi khi kéo chart trong [0, số nến thừa ngoài cửa sổ hiển thị]. */
export function clampPan(panOffset: number, total: number, visible: number): number {
  return Math.min(Math.max(0, panOffset), Math.max(0, total - visible));
}

/** Nhãn thời gian dưới trục chart theo khung: 1D→giờ, 1M→ngày/tháng, 1Y→tháng/năm. */
export function formatChartTime(t: number, range: ChartRange): string {
  const d = new Date(t);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  if (range === "1D") {
    const hh = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${min}`;
  }
  if (range === "1M") return `${dd}/${mm}`;
  return `${mm}/${String(d.getFullYear()).slice(2)}`;
}

const W = 560;
const H = 224;
const PAD = 10;
const LABEL_W = 84; // Gutter phải cho mốc giá.
const TIME_LABEL_H = 22; // Dải dưới cho nhãn thời gian.
const PLOT_BOTTOM = H - PAD - TIME_LABEL_H;
const PLOT_H = PLOT_BOTTOM - PAD;

/** Segmented control (viên thuốc) cho 2 cụm nút chuyển khoảng và kiểu chart:
 *  khung bo tròn chứa các nút, nút đang chọn nổi lên bằng màu chủ đạo. */
const SEGMENT_GROUP = "rounded-full bg-muted p-1 gap-0";
const SEGMENT_ITEM =
  "h-8 rounded-full px-3 text-xs font-medium hover:bg-background/70 hover:text-foreground data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-sm data-[state=on]:hover:bg-primary data-[state=on]:hover:text-primary-foreground";

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
  const [chartType, setChartType] = useState<"line" | "candles">("candles");
  // Kéo thả (pan): panOffset = số nến đã lùi khỏi cửa sổ mới nhất; dragPx =
  // độ lệch pixel lúc đang kéo (chưa thả thì chưa chốt cửa sổ).
  const [panOffset, setPanOffset] = useState(0);
  const [dragPx, setDragPx] = useState(0);
  const dragRef = useRef<{ startX: number; startPan: number } | null>(null);
  const gradientId = useId();
  const clipPlotId = useId();
  const clipTimeId = useId();
  const coin = symbol ? getCoin(symbol) : undefined;
  const candles = useQuery({
    queryKey: ["candles", symbol, range],
    queryFn: () => getCandles({ data: { symbol: symbol ?? "", range } }),
    enabled: open && !!symbol,
    staleTime: 60_000,
  });
  const points = candles.data?.points ?? [];
  const VISIBLE = CHART_VISIBLE_COUNT[range];
  const maxPan = Math.max(0, points.length - VISIBLE);
  const clampedPan = clampPan(panOffset, points.length, VISIBLE);
  const startIndex = Math.max(0, points.length - VISIBLE - clampedPan);
  const visiblePoints = points.slice(startIndex, startIndex + VISIBLE);
  // Đổi khung thời gian / coin thì về lại cửa sổ mới nhất.
  useEffect(() => {
    setPanOffset(0);
    setDragPx(0);
    dragRef.current = null;
  }, [range, symbol]);
  const chart = useMemo(() => {
    if (visiblePoints.length < 2) return null;
    // Miền giá theo cao/thấp thật của nến (bao cả giá đóng).
    let rawMin = Math.min(...visiblePoints.map((p) => p.l));
    let rawMax = Math.max(...visiblePoints.map((p) => p.h));
    if (rawMax === rawMin) {
      rawMin = rawMax * 0.999;
      rawMax = rawMax * 1.001;
    }
    const pad = (rawMax - rawMin) * 0.08;
    const min = rawMin - pad;
    const max = rawMax + pad;
    const plotW = W - PAD * 2 - LABEL_W;
    const x = (i: number) =>
      PAD + (i / Math.max(1, visiblePoints.length - 1)) * plotW;
    const y = (v: number) => PAD + (1 - (v - min) / (max - min)) * PLOT_H;
    const line = visiblePoints
      .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.c).toFixed(1)}`)
      .join(" ");
    const area = `${line} L${x(visiblePoints.length - 1).toFixed(1)},${PLOT_BOTTOM} L${x(0).toFixed(1)},${PLOT_BOTTOM} Z`;
    const last = visiblePoints[visiblePoints.length - 1];
    // Mốc giá theo dữ liệu thật (cao nhất → thấp nhất), hiển thị ở trục phải.
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => {
      const value = rawMax - f * (rawMax - rawMin);
      return { value, y: y(value) };
    });
    // Nến: râu (cao→thấp) + thân (mở→đóng); xanh khi đóng >= mở, đỏ khi giảm.
    // Nến doji (mở = đóng) thì thân cao 1px thành một gạch ngang.
    const bw = Math.max(2, (plotW / visiblePoints.length) * 0.62);
    const candleBars = visiblePoints.map((p, i) => {
      const cx = x(i);
      const top = y(Math.max(p.o, p.c));
      const bottom = y(Math.min(p.o, p.c));
      return {
        cx,
        wickY1: y(p.h),
        wickY2: y(p.l),
        bodyX: cx - bw / 2,
        bodyY: top,
        bodyW: bw,
        bodyH: Math.max(1, bottom - top),
        up: candleIsUp(p),
      };
    });
    // Nhãn thời gian dưới trục: 5 mốc cách đều trong cửa sổ, kẹp cho khỏi tràn.
    const labelIdx = [0, 1, 2, 3, 4].map((k) =>
      Math.round((k * (visiblePoints.length - 1)) / 4),
    );
    const timeLabels = [...new Set(labelIdx)]
      .map((i) => {
        const p = visiblePoints[i];
        if (!p) return null;
        const lx = Math.min(Math.max(x(i), PAD + 16), PAD + plotW);
        return { x: lx, label: formatChartTime(p.t, range) };
      })
      .filter((t): t is { x: number; label: string } => t !== null);
    // Mốc giá cuối (giá đóng nến cuối cửa sổ) trên trục phải; ẩn mốc lưới
    // nào quá gần nó để khỏi đè chữ.
    const lastY = last ? y(last.c) : 0;
    const ticksShown = ticks.filter((t) => Math.abs(t.y - lastY) > 9);
    return {
      line,
      area,
      lastX: last ? x(visiblePoints.length - 1) : 0,
      lastY,
      ticks: ticksShown,
      candleBars,
      timeLabels,
      lastClose: last?.c ?? null,
      stepPx: plotW / Math.max(1, visiblePoints.length - 1),
    };
  }, [visiblePoints, range]);
  // Số liệu theo cửa sổ đang xem (đổi khi kéo thả), không theo toàn bộ dữ liệu nạp.
  const lastVisible =
    visiblePoints.length > 0 ? visiblePoints[visiblePoints.length - 1] : undefined;
  const firstVisible = visiblePoints[0];
  const lastPrice = lastVisible?.c ?? null;
  const high = visiblePoints.length > 0 ? Math.max(...visiblePoints.map((p) => p.h)) : null;
  const low = visiblePoints.length > 0 ? Math.min(...visiblePoints.map((p) => p.l)) : null;
  const change =
    firstVisible && lastVisible && firstVisible.c > 0
      ? ((lastVisible.c - firstVisible.c) / firstVisible.c) * 100
      : null;
  const up = (change ?? 0) >= 0;
  const unit = coin?.unit === "ounce" ? " / ounce" : "";
  const canPan = points.length > VISIBLE;

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!canPan || !chart) return;
    dragRef.current = { startX: e.clientX, startPan: clampedPan };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    setDragPx(e.clientX - dragRef.current.startX);
  }
  function endPan(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current || !chart) return;
    const deltaPx = e.clientX - dragRef.current.startX;
    const steps = Math.round(deltaPx / chart.stepPx);
    // Kéo sang phải → xem nến cũ hơn (tăng độ lùi); kéo sang trái → về nến mới.
    setPanOffset(clampPan(dragRef.current.startPan + steps, points.length, VISIBLE));
    setDragPx(0);
    dragRef.current = null;
  }
  function cancelPan() {
    setDragPx(0);
    dragRef.current = null;
  }

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
          </div>
        </div>

        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <ToggleGroup
            type="single"
            value={range}
            onValueChange={(v) => v && setRange(v as ChartRange)}
            className={SEGMENT_GROUP}
            aria-label="Khoảng thời gian"
          >
            {RANGES.map((r) => (
              <ToggleGroupItem key={r.value} value={r.value} className={SEGMENT_ITEM}>
                {r.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <ToggleGroup
            type="single"
            value={chartType}
            onValueChange={(v) => v && setChartType(v as "line" | "candles")}
            className={SEGMENT_GROUP}
            aria-label="Kiểu biểu đồ"
          >
            <ToggleGroupItem value="line" className={SEGMENT_ITEM}>
              Đường
            </ToggleGroupItem>
            <ToggleGroupItem value="candles" className={SEGMENT_ITEM}>
              Nến
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div
          className="relative touch-none select-none"
          style={{ cursor: canPan ? "grab" : "default" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endPan}
          onPointerCancel={cancelPan}
        >
          {candles.isLoading ? (
            <div className="grid h-[224px] place-items-center text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Đang tải biểu đồ…
              </span>
            </div>
          ) : candles.data?.error || !chart ? (
            <div className="grid h-[224px] place-items-center px-6 text-center text-sm text-muted-foreground">
              {candles.data?.error ?? "Chưa có dữ liệu biểu đồ cho coin này."}
            </div>
          ) : (
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="h-[224px] w-full"
              role="img"
              aria-label={`Biểu đồ giá ${coin?.name ?? symbol}`}
            >
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={up ? "var(--gain)" : "var(--loss)"} stopOpacity="0.35" />
                  <stop offset="100%" stopColor={up ? "var(--gain)" : "var(--loss)"} stopOpacity="0" />
                </linearGradient>
                <clipPath id={clipPlotId}>
                  <rect x={PAD} y={PAD} width={W - PAD * 2 - LABEL_W} height={PLOT_H} />
                </clipPath>
                <clipPath id={clipTimeId}>
                  <rect x={PAD} y={PLOT_BOTTOM} width={W - PAD * 2 - LABEL_W} height={TIME_LABEL_H} />
                </clipPath>
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
              {chart.lastClose != null && (
                <text
                  x={W - 6}
                  y={chart.lastY + 4}
                  textAnchor="end"
                  fontSize="11"
                  fontWeight="700"
                  fill={up ? "var(--gain)" : "var(--loss)"}
                >
                  {money(chart.lastClose, currency !== "USDT")}
                </text>
              )}
              <g clipPath={`url(#${clipPlotId})`} transform={`translate(${dragPx}, 0)`}>
                {chartType === "candles" ? (
                  chart.candleBars.map((c, i) => (
                    <g key={i}>
                      <line
                        x1={c.cx.toFixed(1)}
                        x2={c.cx.toFixed(1)}
                        y1={c.wickY1.toFixed(1)}
                        y2={c.wickY2.toFixed(1)}
                        stroke={c.up ? "var(--gain)" : "var(--loss)"}
                        strokeWidth="1.5"
                      />
                      <rect
                        x={c.bodyX.toFixed(1)}
                        y={c.bodyY.toFixed(1)}
                        width={c.bodyW.toFixed(1)}
                        height={c.bodyH.toFixed(1)}
                        rx="1"
                        fill={c.up ? "var(--gain)" : "var(--loss)"}
                      />
                    </g>
                  ))
                ) : (
                  <>
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
                  </>
                )}
              </g>
              <g clipPath={`url(#${clipTimeId})`} transform={`translate(${dragPx}, 0)`}>
                {chart.timeLabels.map((t, i) => (
                  <text
                    key={i}
                    x={t.x}
                    y={PLOT_BOTTOM + 16}
                    textAnchor="middle"
                    fontSize="11"
                    fill="var(--muted-foreground)"
                  >
                    {t.label}
                  </text>
                ))}
              </g>
            </svg>
          )}
        </div>
        {canPan && (
          <p className="mt-1 text-center text-[11px] text-muted-foreground">
            Kéo sang phải để xem nến cũ hơn, kéo sang trái để về nến mới nhất.
          </p>
        )}

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
