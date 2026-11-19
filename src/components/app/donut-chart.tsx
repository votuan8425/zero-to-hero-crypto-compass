import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { displaySymbol, coinName, getCoin } from "@/lib/coins";
import { formatPercent } from "@/lib/format";
import { CoinLogo } from "./coin-logo";

export const CHART_COLORS = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `var(--chart-${n})`);

export interface DonutItem {
  symbol: string;
  name?: string | null;
  percent: number;
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
  return (
    <div className={showLegend ? "grid items-center gap-6 sm:grid-cols-[minmax(0,240px)_1fr]" : ""}>
      <div className="relative" style={{ height }}>
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
        <ul className="space-y-2.5">
          {data.map((d, i) => (
            <li key={d.symbol} className="flex items-center gap-3 text-sm">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
              />
              <CoinLogo symbol={d.symbol} size={22} />
              <span className="min-w-0 flex-1 truncate">
                <span className="font-medium">{displaySymbol(d.symbol)}</span>
                {!getCoin(d.symbol)?.unit && (
                  <span className="ml-1.5 text-muted-foreground">{coinName(d.symbol, d.name)}</span>
                )}
              </span>
              <span className="num font-medium">{formatPercent(d.percent)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
