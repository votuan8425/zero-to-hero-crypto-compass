import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { displaySymbol, coinName, getCoin } from "@/lib/coins";
import { formatPercent } from "@/lib/format";
import { CoinLogo } from "./coin-logo";
import { PnlText } from "./stat";

export const CHART_COLORS = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `var(--chart-${n})`);

export interface DonutItem {
  symbol: string;
  name?: string | null;
  percent: number;
  /** Lãi/lỗ % theo vốn của riêng token này (null khi chưa có — cột Lãi/Lỗ hiện "—"). */
  pnlPct?: number | null;
}

const RADIAN = Math.PI / 180;
/** Lát nhỏ hơn 8% thì chữ % không đủ chỗ trên vành — để trống, xem % ở bảng dưới. */
const MIN_LABELED_PERCENT = 8;

/**
 * Ghi % lên giữa vành của từng lát cắt.
 *
 * BẪY: Recharts truyền cho label prop `percent` là PHÂN SỐ (0–1) theo
 * tài liệu, NHƯNG khi dataKey="percent" thì lúc dựng sector nó spread
 * data item gốc SAU phân số đã tính, nên `percent` bị ghi đè thành giá
 * trị thô 0–100 (80,93). Dùng `percent * 100` sẽ ra 8093 → hiện "8.093%"
 * (dấu chấm là phân cách hàng nghìn của vi-VN). Vì vậy dùng `value` —
 * giá trị thô của dataKey (0–100) — và KHÔNG nhân 100 nữa.
 */
function renderSlicePercent(props: {
  cx?: number;
  cy?: number;
  midAngle?: number;
  innerRadius?: number;
  outerRadius?: number;
  value?: number;
  percent?: number;
}) {
  const {
    cx = 0,
    cy = 0,
    midAngle = 0,
    innerRadius = 0,
    outerRadius = 0,
    value,
    percent,
  } = props;
  // value là % vị thế 0–100. Dự phòng khi value thiếu: percent có thể là
  // phân số (≤ 1) hoặc giá trị thô (> 1).
  const pct =
    value != null && Number.isFinite(value)
      ? value
      : percent != null && Number.isFinite(percent)
        ? percent <= 1
          ? percent * 100
          : percent
        : NaN;
  if (!Number.isFinite(pct) || pct < MIN_LABELED_PERCENT) return null;
  const radius = innerRadius + (outerRadius - innerRadius) / 2;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={12}
      fontWeight={700}
      fill="#1f2937"
      stroke="rgba(255,255,255,0.9)"
      strokeWidth={3}
      paintOrder="stroke"
    >
      {formatPercent(pct)}
    </text>
  );
}

export function DonutChart({
  items,
  centerLabel,
  centerValue,
  showLegend = true,
  height = 220,
}: {
  items: DonutItem[];
  centerLabel?: string;
  centerValue?: string;
  showLegend?: boolean;
  height?: number;
}) {
  const data = items.filter((i) => i.percent > 0);
  // Bấm một lát cắt thì hiện thông tin của nó ở giữa biểu đồ (thay cho
  // tooltip nổi của Recharts — tooltip đó luôn rơi vào giữa donut và đè lên
  // chữ ở tâm, trông như bị lỗi). Bấm lại lát đó thì trở về mặc định.
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const active = activeIndex != null ? data[activeIndex] : null;
  // Chỉ hiện cột Lãi/Lỗ khi có ít nhất một token có số liệu (danh mục từ
  // ảnh chụp chỉ có % vị thế, không có lãi/lỗ từng token).
  const showPnl = data.some((d) => d.pnlPct != null);
  const cols = showPnl
    ? "grid-cols-[minmax(0,1fr)_72px_72px]"
    : "grid-cols-[minmax(0,1fr)_72px]";
  return (
    <div className="space-y-4">
      <div className="relative mx-auto w-full max-w-[280px]" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="percent"
              nameKey="symbol"
              innerRadius="68%"
              outerRadius="100%"
              paddingAngle={data.length > 1 ? 2 : 0}
              stroke="none"
              isAnimationActive
              label={renderSlicePercent}
              onClick={(_, index) => setActiveIndex((prev) => (prev === index ? null : index))}
            >
              {data.map((d, i) => (
                <Cell
                  key={d.symbol}
                  fill={CHART_COLORS[i % CHART_COLORS.length]}
                  opacity={activeIndex == null || activeIndex === i ? 1 : 0.35}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          {active ? (
            <>
              <div className="num text-xl font-semibold text-primary">{formatPercent(active.percent)}</div>
              <div className="text-[11px] text-muted-foreground">
                {coinName(active.symbol, active.name)}
                {getCoin(active.symbol)?.unit ? "" : ` (${displaySymbol(active.symbol)})`}
              </div>
            </>
          ) : (
            <>
              {centerValue && <div className="num text-xl font-semibold">{centerValue}</div>}
              {centerLabel && (
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  {centerLabel}
                </div>
              )}
            </>
          )}
        </div>
      </div>
      {showLegend && (
        <div>
          <div
            className={`grid ${cols} items-center gap-3 border-b border-border pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground`}
          >
            <span>Token</span>
            <span className="text-right">Vị thế</span>
            {showPnl && <span className="text-right">Lãi / Lỗ</span>}
          </div>
          <ul className="divide-y divide-border">
            {data.map((d, i) => (
              <li key={d.symbol} className="space-y-1.5 py-2.5">
                <div className={`grid ${cols} items-center gap-3`}>
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                    />
                    <CoinLogo symbol={d.symbol} size={22} />
                    <span className="min-w-0 truncate text-sm">
                      <span className="font-semibold">{displaySymbol(d.symbol)}</span>
                      {!getCoin(d.symbol)?.unit && (
                        <span className="ml-1.5 text-muted-foreground">
                          {coinName(d.symbol, d.name)}
                        </span>
                      )}
                    </span>
                  </div>
                  <span className="num text-right text-base font-bold">
                    {formatPercent(d.percent)}
                  </span>
                  {showPnl && (
                    <PnlText value={d.pnlPct ?? null} className="text-right text-base font-bold">
                      {d.pnlPct != null ? formatPercent(d.pnlPct, 2, true) : "—"}
                    </PnlText>
                  )}
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-raised">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, Math.max(0, d.percent))}%`,
                      background: CHART_COLORS[i % CHART_COLORS.length],
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
