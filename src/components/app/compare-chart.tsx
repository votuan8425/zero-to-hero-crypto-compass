import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { displaySymbol } from "@/lib/coins";
import { formatPercent } from "@/lib/format";
import { CHART_COLORS } from "./donut-chart";

export interface CompareSeries {
  key: string;
  label: string;
}

/** Grouped bar chart of allocation % per coin across several portfolios. */
export function CompareChart({ rows, series }: { rows: Record<string, number | string>[]; series: CompareSeries[] }) {
  const data = rows.map((r) => ({ ...r, symbolLabel: displaySymbol(String(r.symbol)) }));
  return (
    <div style={{ height: Math.max(240, 0) }} className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="symbolLabel" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} unit="%" />
          <Tooltip
            cursor={{ fill: "var(--accent)" }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              return (
                <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
                  <div className="mb-1 font-semibold">{label}</div>
                  {payload.map((p) => (
                    <div key={String(p.dataKey)} className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
                      <span className="text-muted-foreground">{p.name}:</span>
                      <span className="num">{formatPercent(Number(p.value))}</span>
                    </div>
                  ))}
                </div>
              );
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: "var(--muted-foreground)" }} />
          {series.map((s, i) => (
            <Bar key={s.key} dataKey={s.key} name={s.label} fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[4, 4, 0, 0]} maxBarSize={28} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
