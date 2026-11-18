/**
 * Biểu đồ xu hướng tổng giá trị tài sản kiểu OKX: đường + vùng chấm
 * (lưới chấm như OKX) dưới đường, màu xanh khi kỳ đang tăng, đỏ khi giảm.
 *
 * Tương tác: rê chuột (hoặc chạm kéo trên điện thoại) → đường kẻ dọc +
 * chấm tròn tại điểm gần nhất, giá trị và thời điểm hiện ở tiêu đề phía
 * trên (do component cha giữ qua onHover). Rời chuột thì về lại giá trị
 * hiện tại. Không có pan/zoom — các kỳ 1W/1M/3M/1Y đổi bằng nút chọn.
 *
 * Khung hình 2:1 — component cha đặt khối chứa theo tỉ lệ này để đường
 * và các chấm không bị kéo méo.
 */

import { useId, useMemo, useRef, useState } from "react";
import type { HistoryPoint } from "@/lib/portfolio-history";
import { cn } from "@/lib/utils";

const W = 640;
const H = 320;
const PAD_X = 4;
const PAD_TOP = 18;
const PAD_BOTTOM = 12;
/** Khoảng cách lưới chấm kiểu OKX (px trong khung viewBox). */
const DOT_STEP = 16;
const DOT_R = 1.8;

export function PortfolioChart({
  points,
  onHover,
  className,
}: {
  points: HistoryPoint[];
  onHover: (p: HistoryPoint | null) => void;
  className?: string;
}) {
  const dotsId = useId();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const up = points.length >= 2 ? points[points.length - 1]!.value >= points[0]!.value : true;

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
    const x = (i: number) =>
      points.length === 1
        ? W / 2
        : PAD_X + (i / (points.length - 1)) * (W - PAD_X * 2);
    const y = (v: number) => PAD_TOP + (1 - (v - min) / (max - min)) * (H - PAD_TOP - PAD_BOTTOM);
    const line =
      points.length === 1
        ? `M${PAD_X},${y(points[0]!.value).toFixed(1)} L${W - PAD_X},${y(points[0]!.value).toFixed(1)}`
        : points
            .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`)
            .join(" ");
    const area =
      points.length === 1
        ? ""
        : `${line} L${x(points.length - 1).toFixed(1)},${H - PAD_BOTTOM} L${x(0).toFixed(1)},${H - PAD_BOTTOM} Z`;
    const stepPx = points.length > 1 ? (W - PAD_X * 2) / (points.length - 1) : W;
    return { line, area, x, y, stepPx };
  }, [points]);

  function indexFromClientX(clientX: number): number | null {
    const svg = svgRef.current;
    if (!svg || !geom || points.length === 0) return null;
    const rect = svg.getBoundingClientRect();
    if (rect.width <= 0) return null;
    const svgX = ((clientX - rect.left) / rect.width) * W;
    if (points.length === 1) return 0;
    const idx = Math.round((svgX - PAD_X) / geom.stepPx);
    return Math.min(Math.max(0, idx), points.length - 1);
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

  return (
    <div className={cn("h-full w-full", up ? "text-gain" : "text-loss", className)}>
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
              fill="var(--muted-foreground)"
              fillOpacity="0.55"
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
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
              style={{ filter: "drop-shadow(0 0 5px currentColor)" }}
            />
            {hovered && hoverIdx != null && (
              <g>
                <line
                  x1={geom.x(hoverIdx)}
                  x2={geom.x(hoverIdx)}
                  y1={PAD_TOP}
                  y2={H - PAD_BOTTOM}
                  stroke="currentColor"
                  strokeOpacity="0.35"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
                <circle
                  cx={geom.x(hoverIdx)}
                  cy={geom.y(hovered.value)}
                  r="10"
                  fill="currentColor"
                  fillOpacity="0.18"
                />
                <circle
                  cx={geom.x(hoverIdx)}
                  cy={geom.y(hovered.value)}
                  r="4.5"
                  fill="currentColor"
                  stroke="var(--background)"
                  strokeWidth="1.5"
                />
              </g>
            )}
            {hoverIdx == null && points.length > 0 && (
              <circle
                cx={geom.x(points.length - 1)}
                cy={geom.y(points[points.length - 1]!.value)}
                r="4.5"
                fill="currentColor"
                stroke="var(--background)"
                strokeWidth="1.5"
              />
            )}
          </>
        )}
      </svg>
    </div>
  );
}
