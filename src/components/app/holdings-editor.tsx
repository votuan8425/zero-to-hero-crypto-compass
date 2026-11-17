import { AlertTriangle, CheckCircle2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { checkPercentSum, type RefHolding } from "@/lib/reference";
import { OTHER_SYMBOL, coinName, normalizeSymbol } from "@/lib/coins";
import { formatPercent } from "@/lib/format";
import { CoinLogo } from "./coin-logo";
import { SourceBadge } from "./reference-analysis";

const num = (s: string): number | null => {
  if (s.trim() === "") return null;
  const n = Number(s.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

export function emptyHolding(symbol = ""): RefHolding {
  return {
    symbol,
    name: null,
    percent: null,
    percent_source: "edited",
    quantity: null,
    value: null,
    value_currency: null,
    confidence: "high",
  };
}

export function HoldingsEditor({
  holdings,
  onChange,
}: {
  holdings: RefHolding[];
  onChange: (h: RefHolding[]) => void;
}) {
  const check = checkPercentSum(holdings);
  const update = (i: number, patch: Partial<RefHolding>) =>
    onChange(holdings.map((h, idx) => (idx === i ? { ...h, ...patch } : h)));

  function assignRemainderToOther() {
    const others = holdings.findIndex((h) => normalizeSymbol(h.symbol) === OTHER_SYMBOL);
    if (others >= 0)
      update(others, {
        percent: Math.round(((holdings[others]?.percent ?? 0) + check.diff) * 100) / 100,
        percent_source: "edited",
      });
    else onChange([...holdings, { ...emptyHolding(OTHER_SYMBOL), percent: check.diff }]);
  }
  function normalizeTo100() {
    if (check.total <= 0) return;
    onChange(
      holdings.map((h) =>
        h.percent == null
          ? h
          : {
              ...h,
              percent: Math.round((h.percent / check.total) * 10000) / 100,
              percent_source: "edited",
            },
      ),
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {holdings.map((h, i) => (
          <div key={i} className="rounded-xl border border-border bg-surface p-3">
            <div className="flex items-center gap-2">
              <CoinLogo symbol={h.symbol || "?"} size={28} />
              <Input
                aria-label="Mã coin"
                value={h.symbol === OTHER_SYMBOL ? "Khác" : h.symbol}
                onChange={(e) =>
                  update(i, {
                    symbol: normalizeSymbol(e.target.value) || e.target.value.toUpperCase(),
                    percent_source: "edited",
                  })
                }
                placeholder="BTC"
                className="h-9 w-24 font-semibold uppercase"
              />
              <span className="hidden min-w-0 flex-1 truncate text-xs text-muted-foreground sm:block">
                {h.symbol ? coinName(h.symbol, h.name) : ""}
              </span>
              <div className="relative ml-auto w-28">
                <Input
                  aria-label="Tỷ lệ phần trăm"
                  inputMode="decimal"
                  value={h.percent ?? ""}
                  onChange={(e) =>
                    update(i, { percent: num(e.target.value), percent_source: "edited" })
                  }
                  placeholder="?"
                  className="num h-9 pr-7 text-right"
                />
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  %
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Xoá dòng"
                onClick={() => onChange(holdings.filter((_, idx) => idx !== i))}
              >
                <Trash2 />
              </Button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 pl-9">
              <Input
                aria-label="Số lượng"
                inputMode="decimal"
                value={h.quantity ?? ""}
                onChange={(e) => update(i, { quantity: num(e.target.value) })}
                placeholder="Số lượng (nếu có)"
                className="num h-8 w-36 text-xs"
              />
              <Input
                aria-label="Giá trị"
                inputMode="decimal"
                value={h.value ?? ""}
                onChange={(e) => update(i, { value: num(e.target.value) })}
                placeholder="Giá trị (nếu có)"
                className="num h-8 w-36 text-xs"
              />
              <SourceBadge source={h.percent_source} />
            </div>
          </div>
        ))}
      </div>
      <Button
        type="button"
        variant="surface"
        size="sm"
        onClick={() => onChange([...holdings, emptyHolding()])}
      >
        <Plus /> Thêm coin
      </Button>

      {holdings.length > 0 &&
        (check.ok ? (
          <div className="flex items-center gap-2 rounded-lg border border-gain/40 bg-gain/10 p-3 text-sm text-gain">
            <CheckCircle2 className="h-4 w-4" /> Tổng tỷ lệ: {formatPercent(check.total)} — hợp lệ.
          </div>
        ) : (
          <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
            <div className="flex gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <div>
                Tổng các tỷ lệ là <b className="num">{formatPercent(check.total)}</b>
                {check.missing > 0 ? `, còn ${check.missing} coin chưa có tỷ lệ` : ""} —{" "}
                {check.diff > 0
                  ? `thiếu ${formatPercent(check.diff)}`
                  : check.diff < 0
                    ? `dư ${formatPercent(-check.diff)}`
                    : "chưa đủ dữ liệu"}{" "}
                so với 100%. Vui lòng kiểm tra lại với ảnh gốc và sửa cho đúng.
              </div>
            </div>
            {check.missing === 0 && check.diff !== 0 && (
              <div className="mt-2 flex flex-wrap gap-2 pl-6">
                {check.diff > 0 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="surface"
                    onClick={assignRemainderToOther}
                  >
                    Gán {formatPercent(check.diff)} còn lại vào “Khác”
                  </Button>
                )}
                <Button type="button" size="sm" variant="surface" onClick={normalizeTo100}>
                  Chuẩn hoá tỷ lệ về 100%
                </Button>
              </div>
            )}
          </div>
        ))}
    </div>
  );
}
