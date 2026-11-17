import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Info } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/app/app-shell";
import { CoinLogo } from "@/components/app/coin-logo";
import { CompareChart } from "@/components/app/compare-chart";
import { usePortfolio, useReferences } from "@/hooks/use-app-data";
import { displaySymbol, normalizeSymbol } from "@/lib/coins";
import { formatPercent } from "@/lib/format";
import { analyzeConcentration } from "@/lib/reference";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/tham-khao/so-sanh")({
  head: () => ({
    meta: [
      { title: "So sánh danh mục tham khảo — ZERO TO HERO" },
      { name: "description", content: "So sánh phân bổ giữa nhiều danh mục tham khảo và danh mục của bạn." },
      { property: "og:title", content: "So sánh danh mục — ZERO TO HERO" },
      { property: "og:description", content: "So sánh phân bổ nhiều danh mục tiền mã hoá." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ComparePage,
});

const MINE = "__mine__";

function ComparePage() {
  const refs = useReferences();
  const { allocation, holdings } = usePortfolio();
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    if (refs.data && selected.length === 0) setSelected(refs.data.slice(0, 2).map((r) => r.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refs.data]);

  const options = useMemo(() => [
    ...(holdings.length ? [{ id: MINE, name: "Danh mục của tôi", items: allocation.slices.map((s) => ({ symbol: s.symbol, percent: s.percent as number | null })) }] : []),
    ...(refs.data ?? []).map((r) => ({ id: r.id, name: r.name, items: r.holdings.map((h) => ({ symbol: h.symbol, percent: h.percent })) })),
  ], [refs.data, allocation.slices, holdings.length]);

  const chosen = options.filter((o) => selected.includes(o.id));
  const symbols = [...new Set(chosen.flatMap((c) => c.items.map((i) => normalizeSymbol(i.symbol))))];
  const rows = symbols.map((s) => {
    const row: Record<string, number | string> = { symbol: s };
    chosen.forEach((c, i) => { row[`p${i}`] = Math.round(c.items.filter((x) => normalizeSymbol(x.symbol) === s).reduce((a, x) => a + (x.percent ?? 0), 0) * 100) / 100; });
    return row;
  }).sort((a, b) => Math.max(...chosen.map((_, i) => Number(b[`p${i}`]))) - Math.max(...chosen.map((_, i) => Number(a[`p${i}`]))));

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= 4 ? s : [...s, id]));

  return (
    <div>
      <Link to="/tham-khao" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Tham khảo</Link>
      <PageHeader title="So sánh danh mục" subtitle="Chọn tối đa 4 danh mục để so sánh tỷ lệ phân bổ." />
      <div className="mb-4 flex gap-2 rounded-lg border border-border bg-surface p-3 text-xs text-muted-foreground">
        <Info className="h-4 w-4 shrink-0" /> Chỉ để tham khảo, không phải khuyến nghị đầu tư và không thay đổi tài sản của bạn.
      </div>
      {refs.isLoading ? <Skeleton className="h-64" /> : (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            {options.map((o) => (
              <button key={o.id} type="button" onClick={() => toggle(o.id)} aria-pressed={selected.includes(o.id)}
                className={cn("rounded-full border px-3.5 py-1.5 text-sm transition-colors", selected.includes(o.id) ? "border-primary bg-primary/15 text-primary" : "border-border bg-surface text-muted-foreground hover:text-foreground")}>
                {o.name}
              </button>
            ))}
          </div>
          {chosen.length < 2 ? (
            <p className="text-sm text-muted-foreground">Hãy chọn ít nhất 2 danh mục.</p>
          ) : (
            <div className="space-y-4">
              <section className="panel p-5"><CompareChart rows={rows} series={chosen.map((c, i) => ({ key: `p${i}`, label: c.name }))} /></section>
              <section className="panel overflow-x-auto">
                <table className="w-full min-w-[480px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="px-4 py-3 font-medium">Đồng coin</th>
                      {chosen.map((c) => <th key={c.id} className="max-w-32 truncate px-4 py-3 text-right font-medium">{c.name}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rows.map((r) => (
                      <tr key={String(r.symbol)}>
                        <td className="px-4 py-3"><span className="flex items-center gap-2"><CoinLogo symbol={String(r.symbol)} size={22} /><b>{displaySymbol(String(r.symbol))}</b></span></td>
                        {chosen.map((c, i) => <td key={c.id} className="num px-4 py-3 text-right">{Number(r[`p${i}`]) ? formatPercent(Number(r[`p${i}`])) : <span className="text-muted-foreground">—</span>}</td>)}
                      </tr>
                    ))}
                    <tr className="bg-surface-raised/50 text-xs text-muted-foreground">
                      <td className="px-4 py-3">Mức độ tập trung</td>
                      {chosen.map((c) => <td key={c.id} className="px-4 py-3 text-right">{analyzeConcentration(c.items).label}</td>)}
                    </tr>
                  </tbody>
                </table>
              </section>
            </div>
          )}
        </>
      )}
    </div>
  );
}
