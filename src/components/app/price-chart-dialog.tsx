import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Minus, Plus } from "lucide-react";
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
import { fetchCandlesFromBrowser } from "@/lib/market-client";
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

/** Nhãn thời gian đầy đủ cho nến đang chọn: 1D→ngày/giờ, 1M→ngày/tháng/năm, 1Y→tháng/năm. */
export function formatSelectedTime(t: number, range: ChartRange): string {
  const d = new Date(t);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  if (range === "1D") {
    const hh = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${dd}/${mm} ${hh}:${min}`;
  }
  if (range === "1M") return `${dd}/${mm}/${yyyy}`;
  return `${mm}/${yyyy}`;
}

/** Bước zoom (đổi số nến hiển thị): phóng to = ít nến hơn (mỗi nến to ra),
 *  thu nhỏ = nhiều nến hơn; kẹp trong [8, tổng số nến đã nạp]. */
export function zoomVisibleCount(
  current: number,
  total: number,
  dir: "in" | "out",
): number {
  const next = dir === "in" ? Math.round(current * 0.7) : Math.round(current * 1.4);
  return Math.min(Math.max(next, 8), Math.max(total, 8));
}

const W = 560;
const H = 224;
const PAD = 10;
const LABEL_W = 84; // Gutter phải cho mốc giá.
const TIME_LABEL_H = 22; // Dải dưới cho nhãn thời gian.
const PLOT_BOTTOM = H - PAD - TIME_LABEL_H;
const PLOT_H = PLOT_BOTTOM - PAD;
/** Khoảng trống bên phải chart (tính bằng số nến): nến mới nhất không bị
 *  dí sát vào trục giá, kéo sang phải vẫn còn chỗ thở. */
const RIGHT_OFFSET_SLOTS = 3;
/** Số nến ít nhất khi phóng to hết cỡ. */
const MIN_VISIBLE = 8;
/** Hộp thông tin nến đang chọn (giá + % của nến đó). */
const TIP_W = 112;
const TIP_H = 44;
/** Ngưỡng phân biệt bấm (chọn nến) với kéo (pan): di chuyển dưới ngưỡng là bấm. */
const TAP_SLOP = 6;

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
  // Zoom: số nến hiển thị trong cửa sổ (mặc định theo khung); nút + / −
  // đổi số này, đổi khung/coin thì về lại mặc định.
  const [visibleCount, setVisibleCount] = useState(CHART_VISIBLE_COUNT[range]);
  // Kéo thả (pan): panOffset = số nến đã lùi khỏi cửa sổ mới nhất.
  const [panOffset, setPanOffset] = useState(0);
  // Nến đang chọn (bấm vào nến): chỉ số trong cửa sổ hiển thị, null = chưa chọn.
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    startPan: number;
    moved: boolean;
  } | null>(null);
  // Nhóm nến + nhóm nhãn thời gian: lúc kéo thì cập nhật transform trực
  // tiếp qua DOM (không setState, không re-render) nên kéo mượt, không giật.
  const candleGroupRef = useRef<SVGGElement | null>(null);
  const timeGroupRef = useRef<SVGGElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const gradientId = useId();
  const clipPlotId = useId();
  const clipTimeId = useId();
  const coin = symbol ? getCoin(symbol) : undefined;
  const candles = useQuery({
    queryKey: ["candles", symbol, range],
    // Server Lovable là nguồn chính (OKX); khi server không lấy được dữ
    // liệu (bị chặn/rate-limit) thì lấy trực tiếp từ trình duyệt (CoinGecko)
    // thay vì báo lỗi — chart vẫn vẽ được.
    queryFn: async () => {
      const server = await getCandles({ data: { symbol: symbol ?? "", range } }).catch(
        () => null,
      );
      if (server && !server.error && server.points.length >= 2) return server;
      return fetchCandlesFromBrowser(symbol ?? "", range);
    },
    enabled: open && !!symbol,
    staleTime: 60_000,
  });
  const points = candles.data?.points ?? [];
  const visible =
    points.length === 0 ? 0 : Math.min(Math.max(visibleCount, MIN_VISIBLE), points.length);
  const maxPan = Math.max(0, points.length - visible);
  const clampedPan = clampPan(panOffset, points.length, visible);
  const startIndex = Math.max(0, points.length - visible - clampedPan);
  const visiblePoints = points.slice(startIndex, startIndex + visible);
  // Đổi khung thời gian / coin thì về lại cửa sổ mới nhất, bỏ chọn nến.
  useEffect(() => {
    setVisibleCount(CHART_VISIBLE_COUNT[range]);
    setPanOffset(0);
    setSelectedIdx(null);
    dragRef.current = null;
    candleGroupRef.current?.setAttribute("transform", "translate(0, 0)");
    timeGroupRef.current?.setAttribute("transform", "translate(0, 0)");
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
    // Bước nến tính cả khoảng trống bên phải: nến cuối không dí sát trục
    // giá mà chừa lại RIGHT_OFFSET_SLOTS ô trống để chart thoáng.
    const stepPx = plotW / Math.max(1, visiblePoints.length - 1 + RIGHT_OFFSET_SLOTS);
    const x = (i: number) => PAD + i * stepPx;
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
    const bw = Math.max(2, stepPx * 0.62);
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
        return { idx: i, x: lx, label: formatChartTime(p.t, range) };
      })
      .filter((t): t is { idx: number; x: number; label: string } => t !== null);
    // Mốc giá cuối (giá đóng nến cuối cửa sổ) trên trục phải; ẩn mốc lưới
    // nào quá gần nó để khỏi đè chữ.
    const lastY = last ? y(last.c) : 0;
    const ticksShown = ticks.filter((t) => Math.abs(t.y - lastY) > 9);
    // Crosshair + hộp thông tin của nến đang chọn: đường đứt nét dọc/ngang
    // qua nến đó, chấm tròn ở giao điểm, hộp giá + % đặt ở phía đối diện
    // với nến đang chọn để không che mất nến.
    let sel: {
      sx: number;
      sy: number;
      close: number;
      pct: number;
      up: boolean;
      boxX: number;
      boxY: number;
      timeLabel: string;
    } | null = null;
    if (selectedIdx !== null) {
      const p = visiblePoints[selectedIdx];
      if (p) {
        const sx = x(selectedIdx);
        const sy = y(p.c);
        const pct = p.o > 0 ? ((p.c - p.o) / p.o) * 100 : 0;
        const boxX = sx < PAD + plotW / 2 ? PAD + plotW - TIP_W : PAD;
        const boxY = Math.min(Math.max(sy - TIP_H / 2, PAD), PLOT_BOTTOM - TIP_H);
        sel = {
          sx,
          sy,
          close: p.c,
          pct,
          up: pct >= 0,
          boxX,
          boxY,
          timeLabel: formatSelectedTime(p.t, range),
        };
      }
    }
    return {
      line,
      area,
      lastX: last ? x(visiblePoints.length - 1) : 0,
      lastY,
      ticks: ticksShown,
      candleBars,
      timeLabels,
      lastClose: last?.c ?? null,
      stepPx,
      plotW,
      sel,
    };
  }, [visiblePoints, range, selectedIdx]);
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
  const canPan = points.length > visible;
  const canZoomIn = visible > MIN_VISIBLE;
  const canZoomOut = visible < points.length;

  function resetDragTransform() {
    candleGroupRef.current?.setAttribute("transform", "translate(0, 0)");
    timeGroupRef.current?.setAttribute("transform", "translate(0, 0)");
  }
  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!chart) return;
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPan: clampedPan,
      moved: false,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current || !chart) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dx) <= TAP_SLOP && Math.abs(dy) <= TAP_SLOP) return;
    dragRef.current.moved = true;
    // Bắt đầu kéo thì bỏ chọn nến (crosshair không còn khớp với nến nữa).
    if (selectedIdx !== null) setSelectedIdx(null);
    if (!canPan) return;
    // Cập nhật transform trực tiếp qua DOM, không setState nên không
    // re-render — kéo mượt 60fps, không giật/lag.
    candleGroupRef.current?.setAttribute("transform", `translate(${dx}, 0)`);
    timeGroupRef.current?.setAttribute("transform", `translate(${dx}, 0)`);
  }
  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current || !chart) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    const isTap = Math.abs(dx) < TAP_SLOP && Math.abs(dy) < TAP_SLOP;
    resetDragTransform();
    if (isTap && svgRef.current) {
      // Bấm: chọn nến gần nhất với điểm bấm (bấm lại nến đang chọn thì bỏ chọn).
      const rect = svgRef.current.getBoundingClientRect();
      const scaleX = W / rect.width;
      const svgX = (e.clientX - rect.left) * scaleX;
      const idx = Math.round((svgX - PAD) / chart.stepPx);
      const clampedIdx = Math.min(Math.max(0, idx), visiblePoints.length - 1);
      setSelectedIdx((prev) => (prev === clampedIdx ? null : clampedIdx));
    } else if (canPan) {
      // Kéo: chốt độ lùi theo nến (làm tròn theo bước nến).
      const steps = Math.round(dx / chart.stepPx);
      setPanOffset(clampPan(dragRef.current.startPan + steps, points.length, visible));
      setSelectedIdx(null);
    }
    dragRef.current = null;
  }
  function onPointerCancel() {
    resetDragTransform();
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
          {/* Zoom: đổi số nến hiển thị (phóng to = ít nến hơn, thu nhỏ =
              nhiều nến hơn). Bấm từng nấc nên mượt, không lag như kéo. */}
          <div
            className="flex items-center gap-0 rounded-full bg-muted p-1"
            role="group"
            aria-label="Phóng to / thu nhỏ biểu đồ"
          >
            <button
              type="button"
              aria-label="Thu nhỏ: xem nhiều nến hơn"
              title="Thu nhỏ: xem nhiều nến hơn"
              disabled={!canZoomOut}
              onClick={() =>
                setVisibleCount((v) => zoomVisibleCount(v, points.length, "out"))
              }
              className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-background/70 hover:text-foreground disabled:opacity-40"
            >
              <Minus className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Phóng to: xem ít nến hơn"
              title="Phóng to: xem ít nến hơn"
              disabled={!canZoomIn}
              onClick={() =>
                setVisibleCount((v) => zoomVisibleCount(v, points.length, "in"))
              }
              className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-background/70 hover:text-foreground disabled:opacity-40"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div
          className="relative touch-none select-none"
          style={{ cursor: canPan ? "grab" : "default" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
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
              ref={svgRef}
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
              <g ref={candleGroupRef} clipPath={`url(#${clipPlotId})`}>
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
              <g ref={timeGroupRef} clipPath={`url(#${clipTimeId})`}>
                {chart.timeLabels
                  .filter((t) => t.idx !== selectedIdx)
                  .map((t) => (
                    <text
                      key={t.idx}
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
              {chart.sel && (
                <g>
                  <line
                    x1={chart.sel.sx}
                    x2={chart.sel.sx}
                    y1={PAD}
                    y2={PLOT_BOTTOM}
                    stroke="var(--foreground)"
                    strokeOpacity="0.45"
                    strokeDasharray="4 4"
                    strokeWidth="1"
                  />
                  <line
                    x1={PAD}
                    x2={PAD + chart.plotW}
                    y1={chart.sel.sy}
                    y2={chart.sel.sy}
                    stroke="var(--foreground)"
                    strokeOpacity="0.45"
                    strokeDasharray="4 4"
                    strokeWidth="1"
                  />
                  <circle
                    cx={chart.sel.sx}
                    cy={chart.sel.sy}
                    r="4.5"
                    fill="var(--background)"
                    stroke="var(--foreground)"
                    strokeWidth="1.5"
                  />
                  <text
                    x={chart.sel.sx}
                    y={PLOT_BOTTOM + 16}
                    textAnchor="middle"
                    fontSize="11"
                    fontWeight="700"
                    fill="var(--primary)"
                  >
                    {chart.sel.timeLabel}
                  </text>
                  <g>
                    <rect
                      x={chart.sel.boxX}
                      y={chart.sel.boxY}
                      width={TIP_W}
                      height={TIP_H}
                      rx="8"
                      fill="var(--popover)"
                      stroke="var(--border)"
                    />
                    <text
                      x={chart.sel.boxX + 10}
                      y={chart.sel.boxY + 18}
                      fontSize="13"
                      fontWeight="700"
                      fill="var(--popover-foreground)"
                    >
                      {money(chart.sel.close, currency !== "USDT")}
                    </text>
                    <text
                      x={chart.sel.boxX + 10}
                      y={chart.sel.boxY + 35}
                      fontSize="11"
                      fontWeight="600"
                      fill={chart.sel.up ? "var(--gain)" : "var(--loss)"}
                    >
                      {chart.sel.pct >= 0 ? "+" : ""}
                      {formatNumber(chart.sel.pct, 2)}%
                    </text>
                  </g>
                </g>
              )}
            </svg>
          )}
        </div>
        <p className="mt-1 text-center text-[11px] text-muted-foreground">
          {canPan
            ? "Kéo để xem nến cũ hơn · Bấm vào nến để xem giá · Nút + / − để phóng to, thu nhỏ."
            : "Bấm vào nến để xem giá · Nút + / − để phóng to, thu nhỏ."}
        </p>

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
