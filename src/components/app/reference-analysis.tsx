import { AlertTriangle, PieChart as PieIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  analyzeConcentration,
  SOURCE_LABEL,
  type DataSource,
  type RefHolding,
} from "@/lib/reference";
import { coinName, displaySymbol } from "@/lib/coins";
import { formatNumber, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CoinLogo } from "./coin-logo";
import { DonutChart } from "./donut-chart";

export function SourceBadge({ source }: { source: DataSource }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "whitespace-nowrap text-[10px] font-medium",
        source === "extracted" && "border-gain/40 text-gain",
        source === "computed" && "border-warning/50 text-warning",
        source === "unknown" && "border-border text-muted-foreground",
        source === "edited" && "border-info/50 text-info",
      )}
    >
      {SOURCE_LABEL[source]}
    </Badge>
  );
}

function formatValue(v: number | null, cur: string | null) {
  if (v == null) return "—";
  const c = (cur ?? "").toUpperCase();
  if (c === "VND") return `${formatNumber(v, 0)} ₫`;
  if (c === "USD" || c === "USDT" || c === "USDC" || c === "")
    return `${c === "USD" || c === "" ? "$" : ""}${formatNumber(v, 2)}${c && c !== "USD" ? ` ${c}` : ""}`;
  return `${formatNumber(v, 2)} ${c}`;
}

export function ReferenceAnalysis({
  holdings,
  totalValue,
  totalCurrency,
}: {
  holdings: RefHolding[];
  totalValue?: number | null;
  totalCurrency?: string | null;
}) {
  const conc = analyzeConcentration(holdings);
  const known = holdings.filter((h) => h.percent != null);
  const unknown = holdings.filter((h) => h.percent == null);
  const top = [...known].sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0)).slice(0, 3);
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <section className="panel p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider">Phân bổ danh mục</h3>
          {known.length ? (
            <DonutChart
              items={known.map((h) => ({
                symbol: h.symbol,
                name: h.name,
                percent: h.percent ?? 0,
              }))}
              centerValue={String(conc.count)}
              centerLabel="loại coin"
            />
          ) : (
            <div className="flex flex-col items-center py-10 text-center text-sm text-muted-foreground">
              <PieIcon className="mb-2 h-6 w-6" />
              Chưa có tỷ lệ phân bổ để vẽ biểu đồ.
            </div>
          )}
        </section>
        <section className="panel p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider">Tóm tắt phân bổ</h3>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-surface-raised p-3">
              <dt className="text-xs text-muted-foreground">Số loại coin</dt>
              <dd className="num text-lg font-semibold">{conc.count}</dd>
            </div>
            <div className="rounded-lg bg-surface-raised p-3">
              <dt className="text-xs text-muted-foreground">Mức độ tập trung</dt>
              <dd className="text-lg font-semibold text-primary">
                {known.length ? conc.label : "—"}
              </dd>
            </div>
            <div className="rounded-lg bg-surface-raised p-3">
              <dt className="text-xs text-muted-foreground">Tỷ trọng lớn nhất</dt>
              <dd className="num text-lg font-semibold">
                {conc.top1
                  ? `${displaySymbol(conc.top1.symbol)} ${formatPercent(conc.top1.percent)}`
                  : "—"}
              </dd>
            </div>
            <div className="rounded-lg bg-surface-raised p-3">
              <dt className="text-xs text-muted-foreground">Top 3 chiếm</dt>
              <dd className="num text-lg font-semibold">
                {known.length ? formatPercent(conc.top3Percent) : "—"}
              </dd>
            </div>
            {totalValue != null && (
              <div className="col-span-2 rounded-lg bg-surface-raised p-3">
                <dt className="text-xs text-muted-foreground">Tổng giá trị danh mục (trong ảnh)</dt>
                <dd className="num text-lg font-semibold">
                  {formatValue(totalValue, totalCurrency ?? null)}
                </dd>
              </div>
            )}
          </dl>
          {top.length > 0 && (
            <div className="mt-4">
              <div className="mb-2 text-xs text-muted-foreground">Nắm giữ lớn nhất</div>
              <div className="space-y-2">
                {top.map((h) => (
                  <div key={h.symbol} className="flex items-center gap-2 text-sm">
                    <CoinLogo symbol={h.symbol} size={20} />
                    <span className="w-14 font-medium">{displaySymbol(h.symbol)}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-raised">
                      <div
                        className="lime-gradient h-full rounded-full"
                        style={{ width: `${Math.min(100, h.percent ?? 0)}%` }}
                      />
                    </div>
                    <span className="num w-14 text-right">{formatPercent(h.percent)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <p className="mt-4 text-xs text-muted-foreground">
            Chỉ số HHI: <span className="num">{formatNumber(conc.hhi, 0)}</span>/10.000 — càng cao
            càng tập trung vào ít coin.
          </p>
        </section>
      </div>

      {unknown.length > 0 && (
        <div className="flex gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            Không xác định được tỷ lệ của: {unknown.map((u) => displaySymbol(u.symbol)).join(", ")}.
            Bạn có thể bổ sung trong phần chỉnh sửa.
          </span>
        </div>
      )}

      <section className="panel overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3 font-medium">Đồng coin</th>
              <th className="px-4 py-3 text-right font-medium">Tỷ lệ</th>
              <th className="px-4 py-3 text-right font-medium">Số lượng</th>
              <th className="px-4 py-3 text-right font-medium">Giá trị</th>
              <th className="px-4 py-3 font-medium">Nguồn dữ liệu</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {holdings.map((h) => (
              <tr key={h.symbol}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <CoinLogo symbol={h.symbol} size={28} />
                    <div>
                      <div className="font-semibold">{displaySymbol(h.symbol)}</div>
                      <div className="text-xs text-muted-foreground">
                        {coinName(h.symbol, h.name)}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="num px-4 py-3 text-right font-semibold">
                  {formatPercent(h.percent)}
                </td>
                <td className="num px-4 py-3 text-right">
                  {h.quantity != null ? (
                    formatNumber(h.quantity)
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="num px-4 py-3 text-right">
                  {formatValue(h.value, h.value_currency)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-1">
                    <SourceBadge source={h.percent_source} />
                    {h.confidence === "low" && (
                      <Badge
                        variant="outline"
                        className="border-warning/50 text-[10px] text-warning"
                      >
                        Độ tin cậy thấp
                      </Badge>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
