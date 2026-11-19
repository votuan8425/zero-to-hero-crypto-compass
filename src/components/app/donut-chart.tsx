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

/** Lát nhỏ hơn 5% thì không ghi nhãn ngoài (dễ chồng lên nhau) — xem ở bảng dưới. */
const MIN_LABELED_PERCENT = 5;

/**
 * Nhãn "Tên %" đặt BÊN NGOÀI vòng tròn, nối với lát bằng đường kẻ màu
 * của lát (Recharts vẽ sẵn qua prop labelLine; hàm này chỉ vẽ chữ tại
 * điểm cuối của đường kẻ mà Recharts truyền qua x/y/textAnchor).
 *
 * BẪY: khi dataKey="percent", prop `percent` của sector là giá trị thô
 * 0–100 (data item gốc spread đè lên phân số đã tính), KHÔNG phải phân
 * số 0–1. Vì vậy dùng `value` (giá trị thô của dataKey, 0–100) và KHÔNG
 * nhân 100 — nhân thêm sẽ ra 8093 → hiện "8.093%".
 */
function renderOutsideLabel(props: {
  x?: number;
  y?: number;
  textAnchor?: string;
  value?: number;
  payload?: DonutItem;
  fill?: string;
}) {
  const { x = 0, y = 0, textAnchor = "middle", value, payload, fill } = props;
  const pct = value != null && Number.isFinite(value) ? value : NaN;
  if (!Number.isFinite(pct) || pct < MIN_LABELED_PERCENT) return null;
  const symbol = payload?.symbol ?? "";
  return (
    <text
      x={x}
      y={y}
      textAnchor={textAnchor as "start" | "middle" | "end"}
      dominantBaseline="central"
      fontSize={12}
      style={{ fill: "var(--foreground)" }}
    >
      <tspan fontWeight={600}>{displaySymbol(symbol)}</tspan>
      <tspan fontWeight={700} style={{ fill: fill ?? "var(--foreground)" }}>
        {" "}
        {formatPercent(pct)}
      </tspan>
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
  return (
    <div className="space-y-4">
      {/* Vòng tròn nhỏ lại để chừa chỗ cho nhãn ngoài hai bên (nhãn dài
          "ETH 80,95%" cần ~70px mỗi bên). */}
      <div className="relative mx-auto w-full max-w-[440px]" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="percent"
              nameKey="symbol"
              innerRadius="48%"
              outerRadius="68%"
              paddingAngle={data.length > 1 ? 2 : 0}
              stroke="none"
              isAnimationActive
              label={renderOutsideLabel}
              labelLine
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
      {/* Bảng giải thích bên dưới: % vị thế đã nằm trên đồ thị (nhãn
          ngoài) nên bảng KHÔNG lặp lại con số đó nữa — bảng chỉ giải
          thích lãi/lỗ từng token. Chưa có lãi/lỗ (danh mục từ ảnh chụp)
          thì bảng hiện % vị thế để bù cho nhãn ngoài có thể thiếu. */}
      {showLegend && (
        <div>
          <div className="grid grid-cols-[minmax(0,1fr)_72px] items-center gap-3 border-b border-border pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <span>Token</span>
            <span className="text-right">{showPnl ? "Lãi / Lỗ" : "Vị thế"}</span>
          </div>
          <ul className="divide-y divide-border">
            {data.map((d, i) => (
              <li key={d.symbol} className="space-y-1.5 py-2.5">
                <div className="grid grid-cols-[minmax(0,1fr)_72px] items-center gap-3">
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
                  {showPnl ? (
                    <PnlText value={d.pnlPct ?? null} className="text-right text-base font-bold">
                      {d.pnlPct != null ? formatPercent(d.pnlPct, 2, true) : "—"}
                    </PnlText>
                  ) : (
                    <span className="num text-right text-base font-bold">
                      {formatPercent(d.percent)}
                    </span>
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
