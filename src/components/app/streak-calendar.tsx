import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LOCALE, toDateKey } from "@/lib/format";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

/** Monthly accumulation calendar; highlighted days have at least one purchase. */
export function StreakCalendar({ counts }: { counts: Map<string, number> }) {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const days = useMemo(() => {
    const first = new Date(month);
    const offset = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const cells: (Date | null)[] = Array.from({ length: offset }, () => null);
    for (let d = 1; d <= daysInMonth; d++)
      cells.push(new Date(month.getFullYear(), month.getMonth(), d));
    return cells;
  }, [month]);
  const today = toDateKey(new Date());
  const title = new Intl.DateTimeFormat(LOCALE, { month: "long", year: "numeric" }).format(month);
  const monthActive = days.filter((d) => d && counts.has(toDateKey(d))).length;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="font-semibold capitalize">{title}</div>
          <div className="text-xs text-muted-foreground">
            {monthActive} ngày tích sản trong tháng
          </div>
        </div>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Tháng trước"
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Tháng sau"
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1.5 text-center">
        {WEEKDAYS.map((w) => (
          <div key={w} className="pb-1 text-[10px] font-semibold text-muted-foreground">
            {w}
          </div>
        ))}
        {days.map((d, i) => {
          if (!d) return <div key={`e${i}`} />;
          const k = toDateKey(d);
          const n = counts.get(k) ?? 0;
          return (
            <div
              key={k}
              title={n ? `${n} lần mua` : undefined}
              className={cn(
                "num relative grid aspect-square place-items-center rounded-lg text-xs",
                n > 0
                  ? "lime-gradient font-bold text-primary-foreground"
                  : "bg-surface-raised text-muted-foreground",
                k === today && "ring-2 ring-primary ring-offset-2 ring-offset-background",
              )}
            >
              {d.getDate()}
              {n > 1 && (
                <span className="absolute right-0.5 top-0.5 text-[8px] leading-none">×{n}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
