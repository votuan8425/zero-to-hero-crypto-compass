import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { displaySymbol, coinName } from "@/lib/coins";
import { formatPercent } from "@/lib/format";
import { CoinLogo } from "./coin-logo";

export const CHART_COLORS = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `var(--chart-${n})`);

export interface DonutItem {
  symbol: string;
  name?: string | null;
  percent: number;
}

export function DonutChart({ items, centerLabel, centerValue, showLegend = true, height = 220 }: { items: DonutItem[]; centerLabel?: string; centerValue?: string; showLegend?: boolean; height?: number }) {
  const data = items.filter((i) => i.percent > 0);
  return (
    <div className={showLegend ? "grid items-center gap-6 sm:grid-cols-[minmax(0,240px)_1fr]" : ""}>
      <div className="relative" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="percent" nameKey="symbol" innerRadius="68%" outerRadius="100%" paddingAngle={data.length > 1 ? 2 : 0} stroke="none" isAnimationActive>
              {data.map((d, i) => <Cell key={d.symbol} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Pie>
            <Tooltip
              cursor={false}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0]?.payload as DonutItem | undefined;
                if (!p) return null;
                return (
                  <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
                    <div className="font-semibold">{coinName(p.symbol, p.name)} ({displaySymbol(p.symbol)})</div>
                    <div className="num text-primary">{formatPercent(p.percent)}</div>
                  </div>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        {(centerLabel || centerValue) && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            {centerValue && <div className="num text-xl font-semibold">{centerValue}</div>}
            {centerLabel && <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{centerLabel}</div>}
          </div>
        )}
      </div>
      {showLegend && (
        <ul className="space-y-2.5">
          {data.map((d, i) => (
            <li key={d.symbol} className="flex items-center gap-3 text-sm">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
              <CoinLogo symbol={d.symbol} size={22} />
              <span className="min-w-0 flex-1 truncate">
                <span className="font-medium">{displaySymbol(d.symbol)}</span>
                <span className="ml-1.5 text-muted-foreground">{coinName(d.symbol, d.name)}</span>
              </span>
              <span className="num font-medium">{formatPercent(d.percent)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
