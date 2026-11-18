/**
 * Biểu đồ xu hướng tổng giá trị tài sản kiểu OKX: đường thẳng nối từng
 * điểm + vùng chấm dưới đường, màu xanh khi kỳ đang tăng, hồng neon khi
 * giảm. Độ mềm của OKX đến từ viền sáng (halo) quanh đường — 2 lớp phát
 * sáng chồng nhau — chứ không phải từ việc bo tròn đường.
 *
 * Trục X là THỜI GIAN THẬT (không dàn đều theo chỉ số): mua hôm nay thì
 * trước đó đường phẳng ở 0 từ đầu kỳ, rồi nhảy lên đúng ngày mua và
 * lên/xuống theo lãi lỗ sau đó — đúng logic OKX.
 *
 * Tương tác: rê chuột (hoặc chạm kéo trên điện thoại) → đường kẻ dọc +
 * chấm tròn tại điểm gần nhất + bong bóng hiện giá trị và thời điểm ngay
 * trên chart; số lớn phía trên cũng đổi theo điểm đang chạm. Rời chuột
 * thì về lại giá trị hiện tại. Không có pan/zoom — các kỳ 1W/1M/3M/1Y
 * đổi bằng nút chọn.
 *
 * Khung hình 2:1 — component cha đặt khối chứa theo tỉ lệ này để đường
 * và các chấm không bị kéo méo.
 */

import { useId, useMemo, useRef, useState } from "react";
import type { HistoryPoint } from "@/lib/portfolio-history";
import { formatDateTime, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

const W = 640;
const H = 320;
const PAD_X = 4;
const PAD_TOP = 18;
const PAD_BOTTOM = 12;
/** Khoảng cách lưới chấm kiểu OKX (px trong khung viewBox). */
const DOT_STEP = 12;
const DOT_R = 1.5;

/** Chỉ số của điểm có mốc thời gian gần `t` nhất (cho hover theo thời gian). */
export function nearestPointIndex(points: HistoryPoint[], t: number): number | null {
  if (points.length === 0) return null;
  let best = 0;
  let bestDist = Math.abs(points[0]!.t - t);
  for (let i = 1; i < points.length; i++) {
    const d = Math.abs(points[i]!.t - t);
    // Bằng khoảng cách thì lấy điểm sau (giá trị sau cú nhảy mua vào).
    if (d <= bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

export function PortfolioChart({
  points,
  fromMs,
  toMs,
  onHover,
  formatValue,
  className,
}: {
  points: HistoryPoint[];
  fromMs: number;
  toMs: number;
  onHover: (p: HistoryPoint | null) => void;
  /** Cách hiện giá trị trong bong bóng hover (mặc định: USD). */
  formatValue?: (usdValue: number) => string;
  className?: string;
}) {
  const dotsId = useId();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  // Màu theo hướng đi từ lần mua đầu (đoạn phẳng 0 trước đó không tính):
  // tổng giá trị tăng từ lúc bắt đầu mua thì xanh, giảm thì hồng.
  const firstNonZero = points.find((p) => p.value > 0);
  const up =
    firstNonZero == null
      ? true
      : points[points.length - 1]!.value >= firstNonZero.value;

  const geom = useMemo(() => {
    if (points.length === 0) return null;
    const vals = points.map((p) => p.value);
    let min = Math.min(...vals);
    let max = Math.max(...vals);
    if (max - min < 1e-9) {
      // Đường phẳng (giá trị không đổi): vẫn vẽ được, không chia cho 0.
      max = min + 1;
      min = min - 1;
    }
    const pad = (max - min) * 0.08;
    min -= pad;
    max += pad;
    // Trục X theo thời gian thật: điểm mua hôm nay nằm đúng ở mép phải,
    // không bị kéo dãn ra toàn bộ chiều rộng.
    const span = Math.max(1, toMs - fromMs);
    const x = (t: number) => PAD_X + ((t - fromMs) / span) * (W - PAD_X * 2);
    const y = (v: number) => PAD_TOP + (1 - (v - min) / (max - min)) * (H - PAD_TOP - PAD_BOTTOM);
    const line =
      points.length === 1
        ? `M${PAD_X},${y(points[0]!.value).toFixed(1)} L${W - PAD_X},${y(points[0]!.value).toFixed(1)}`
        : points
            .map((p, i) => `${i === 0 ? "M" : "L"}${x(p.t).toFixed(1)},${y(p.value).toFixed(1)}`)
            .join(" ");
    const area =
      points.length === 1
        ? ""
        : `${line} L${x(points[points.length - 1]!.t).toFixed(1)},${H - PAD_BOTTOM} L${x(points[0]!.t).toFixed(1)},${H - PAD_BOTTOM} Z`;
    return { line, area, x, y };
  }, [points, fromMs, toMs]);

  function indexFromClientX(clientX: number): number | null {
    const svg = svgRef.current;
    if (!svg || !geom || points.length === 0) return null;
    const rect = svg.getBoundingClientRect();
    if (rect.width <= 0) return null;
    const svgX = ((clientX - rect.left) / rect.width) * W;
    const t = fromMs + ((svgX - PAD_X) / (W - PAD_X * 2)) * (toMs - fromMs);
    return nearestPointIndex(points, t);
  }

  function onPointerMove(e: React.PointerEvent) {
    const idx = indexFromClientX(e.clientX);
    if (idx == null) return;
    setHoverIdx(idx);
    onHover(points[idx] ?? null);
  }

  function onPointerLeave() {
    setHoverIdx(null);
    onHover(null);
  }

  const hovered = hoverIdx != null ? points[hoverIdx] : null;
  // Vị trí bong bóng hover (theo % khối chứa): 1 dòng cho gọn, kẹp trong
  // khung, lật xuống dưới chấm khi chấm ở nửa trên để không bị cắt.
  const tip =
    hovered && geom
      ? {
          left: `${(geom.x(hovered.t) / W) * 100}%`,
          top: `${(geom.y(hovered.value) / H) * 100}%`,
          xPct: (geom.x(hovered.t) / W) * 100,
          above: geom.y(hovered.value) > H * 0.45,
        }
      : null;

  return (
    <div className={cn("relative h-full w-full", up ? "text-gain" : "text-chart-down", className)}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="block h-full w-full touch-none select-none"
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        onPointerDown={onPointerMove}
        role="img"
        aria-label="Biểu đồ xu hướng tổng giá trị tài sản"
      >
        <defs>
          <pattern
            id={dotsId}
            width={DOT_STEP}
            height={DOT_STEP}
            patternUnits="userSpaceOnUse"
          >
            <circle
              cx={DOT_STEP / 2}
              cy={DOT_STEP / 2}
              r={DOT_R}
              fill="currentColor"
              fillOpacity="0.6"
            />
          </pattern>
        </defs>
        {geom && (
          <>
            {geom.area && <path d={geom.area} fill={`url(#${dotsId})`} />}
            <path
              d={geom.line}
              fill="none"
              stroke="currentColor"
              strokeWidth="3.5"
              strokeLinejoin="round"
              strokeLinecap="round"
              style={{
                filter:
                  "drop-shadow(0 0 6px currentColor) drop-shadow(0 0 16px currentColor)",
              }}
            />
            {hovered && hoverIdx != null && (
              <g>
                <line
                  x1={geom.x(hovered.t)}
                  x2={geom.x(hovered.t)}
                  y1={PAD_TOP}
                  y2={H - PAD_BOTTOM}
                  stroke="currentColor"
                  strokeOpacity="0.55"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                />
                <circle
                  cx={geom.x(hovered.t)}
                  cy={geom.y(hovered.value)}
                  r="12"
                  fill="currentColor"
                  fillOpacity="0.18"
                  style={{ filter: "drop-shadow(0 0 6px currentColor)" }}
                />
                <circle
                  cx={geom.x(hovered.t)}
                  cy={geom.y(hovered.value)}
                  r="5.5"
                  fill="currentColor"
                  stroke="var(--background)"
                  strokeWidth="1.5"
                />
              </g>
            )}
            {hoverIdx == null && points.length > 0 && (
              <circle
                cx={geom.x(points[points.length - 1]!.t)}
                cy={geom.y(points[points.length - 1]!.value)}
                r="4.5"
                fill="currentColor"
                stroke="var(--background)"
                strokeWidth="1.5"
                style={{ filter: "drop-shadow(0 0 5px currentColor)" }}
              />
            )}
          </>
        )}
      </svg>
      {tip && hovered && (
        <div
          className="pointer-events-none absolute z-10 whitespace-nowrap rounded-lg border bg-background px-2.5 py-1.5 text-left text-xs shadow-xl"
          style={{
            left: tip.left,
            top: tip.top,
            transform: `translate(${tip.xPct < 16 ? "-4%" : tip.xPct > 84 ? "-96%" : "-50%"}, ${tip.above ? "calc(-100% - 10px)" : "12px"})`,
          }}
        >
          <span className="font-semibold">
            {formatValue ? formatValue(hovered.value) : formatMoney(hovered.value, "USDT")}
          </span>
          <span className="text-muted-foreground"> · {formatDateTime(hovered.t)}</span>
        </div>
      )}
    </div>
  );
}
