import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { COINS, displaySymbol, getCoin } from "@/lib/coins";
import { saveTransaction } from "@/lib/data";
import { formatMoney, todayKey, type Currency } from "@/lib/format";
import type { Tx } from "@/lib/portfolio";
import { usePrices } from "@/hooks/use-app-data";
import { useUser } from "@/hooks/use-user";
import { CoinLogo } from "./coin-logo";

const parseNum = (s: string) => {
  const n = Number(s.replace(/\s/g, "").replace(/,/g, "."));
  return Number.isFinite(n) ? n : NaN;
};

export function TransactionDialog({
  open,
  onOpenChange,
  existing,
  defaultCurrency,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  existing?: Tx | null;
  defaultCurrency: Currency;
}) {
  const user = useUser();
  const qc = useQueryClient();
  const [symbol, setSymbol] = useState("BTC");
  const [qty, setQty] = useState("");
  const [cur, setCur] = useState<Currency>(defaultCurrency);
  const [price, setPrice] = useState("");
  const [fee, setFee] = useState("");
  const [date, setDate] = useState(todayKey());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const prices = usePrices();
  const usdVnd = prices.data?.usdVnd ?? null;
  const usdKrw = prices.data?.usdKrw ?? null;
  /** Số đơn vị tiền tệ tương ứng 1 USDT (USDT = 1). */
  const rateFor = (c: Currency): number | null =>
    c === "VND" ? usdVnd : c === "KRW" ? usdKrw : 1;

  useEffect(() => {
    if (!open) return;
    setCur(defaultCurrency);
    if (existing) {
      const r = rateFor(defaultCurrency) ?? 1;
      const useCur: Currency = rateFor(defaultCurrency) ? defaultCurrency : "USDT";
      setCur(useCur);
      setSymbol(existing.symbol);
      setQty(String(existing.quantity));
      setPrice(String(Math.round(existing.price_usd * r * 1e6) / 1e6));
      setFee(existing.fee_usd ? String(Math.round(existing.fee_usd * r * 100) / 100) : "");
      setDate(existing.tx_date);
      setNote(existing.note ?? "");
    } else {
      setQty("");
      setPrice("");
      setFee("");
      setDate(todayKey());
      setNote("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existing]);

  const q = parseNum(qty);
  const p = parseNum(price);
  const f = fee ? parseNum(fee) : 0;
  const total =
    Number.isFinite(q) && Number.isFinite(p) ? q * p + (Number.isFinite(f) ? f : 0) : null;
  const live = prices.data?.prices[symbol];
  const metal = getCoin(symbol)?.unit ? getCoin(symbol) : undefined;

  const toUsd = useMemo(() => {
    const r = rateFor(cur);
    return (v: number) => (cur === "USDT" ? v : r ? v / r : NaN);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur, usdVnd, usdKrw]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!Number.isFinite(q) || q <= 0) {
      toast.error("Số lượng phải lớn hơn 0.");
      return;
    }
    if (!Number.isFinite(p) || p < 0) {
      toast.error("Giá mua không hợp lệ.");
      return;
    }
    if (!Number.isFinite(f) || f < 0) {
      toast.error("Phí giao dịch không hợp lệ.");
      return;
    }
    if (cur !== "USDT" && !rateFor(cur)) {
      toast.error("Chưa có tỷ giá. Vui lòng nhập giá bằng USDT hoặc thử lại khi có mạng.");
      return;
    }
    if (date > todayKey()) {
      toast.error("Ngày mua không thể ở tương lai.");
      return;
    }
    setBusy(true);
    try {
      const status = await saveTransaction(
        qc,
        user.id,
        {
          symbol,
          coin_name: getCoin(symbol)?.name ?? symbol,
          quantity: q,
          price_usd: toUsd(p),
          fee_usd: toUsd(f || 0),
          tx_date: date,
          note: note.trim() || null,
        },
        existing ?? undefined,
      );
      toast.success(
        status === "queued"
          ? "Đã lưu tạm trên thiết bị. Sẽ đồng bộ khi có mạng."
          : existing
            ? "Đã cập nhật giao dịch."
            : "Đã ghi nhận lần tích sản!",
      );
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error("Không lưu được giao dịch. Vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{existing ? "Sửa giao dịch" : "Thêm lần tích sản"}</DialogTitle>
          <DialogDescription>Ghi lại một lần mua định kỳ (DCA).</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Tài sản</Label>
            <Select
              value={symbol}
              onValueChange={(v) => {
                setSymbol(v);
                // Giá vàng SJC / bạc Ancarat niêm yết bằng VND.
                if (getCoin(v)?.unit) setCur("VND");
              }}
            >
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {COINS.map((c) => (
                  <SelectItem key={c.symbol} value={c.symbol}>
                    <span className="flex items-center gap-2">
                      <CoinLogo symbol={c.symbol} size={18} /> {c.name} ({displaySymbol(c.symbol)})
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qty">Số lượng ({metal?.unit ?? displaySymbol(symbol)})</Label>
            <Input
              id="qty"
              inputMode="decimal"
              required
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder={metal ? "Ví dụ: 1" : "Ví dụ: 0,005"}
              className="num h-11"
            />
            {metal && (
              <p className="text-xs text-muted-foreground">
                {metal.symbol === "PAXG"
                  ? "Vàng tính theo chỉ (1 lượng = 10 chỉ), giá theo vàng SJC."
                  : "Bạc tính theo lượng, giá theo bạc Ancarat."}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="price">Giá mua mỗi {metal?.unit ?? displaySymbol(symbol)}</Label>
              <ToggleGroup
                type="single"
                size="sm"
                value={cur}
                onValueChange={(v) => v && setCur(v as Currency)}
              >
                <ToggleGroupItem value="VND" className="h-7 px-2.5 text-xs">
                  VND
                </ToggleGroupItem>
                <ToggleGroupItem value="USDT" className="h-7 px-2.5 text-xs">
                  USDT
                </ToggleGroupItem>
                <ToggleGroupItem value="KRW" className="h-7 px-2.5 text-xs">
                  KRW
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
            <div className="flex gap-2">
              <Input
                id="price"
                inputMode="decimal"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder={
                  metal && cur === "VND"
                    ? metal.symbol === "PAXG"
                      ? "Ví dụ: 13720000"
                      : "Ví dụ: 1598000"
                    : cur === "VND"
                    ? "Ví dụ: 1650000000"
                    : cur === "KRW"
                      ? "Ví dụ: 88000000"
                      : "Ví dụ: 64000"
                }
                className="num h-11"
              />
              <Button
                type="button"
                variant="surface"
                className="h-11 shrink-0"
                disabled={!live}
                onClick={() => {
                  if (!live) return;
                  // Vàng/bạc: lần mua dùng giá bán ra của SJC / Ancarat.
                  const askUsd =
                    live.askVnd != null && usdVnd ? live.askVnd / usdVnd : live.usd;
                  setPrice(
                    String(
                      cur === "USDT"
                        ? Math.round(askUsd * 1e6) / 1e6
                        : cur === "KRW"
                          ? Math.round(usdKrw ? askUsd * usdKrw : live.krw)
                          : Math.round(live.askVnd ?? live.vnd),
                    ),
                  );
                }}
              >
                Giá hiện tại
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="fee">Phí ({cur})</Label>
              <Input
                id="fee"
                inputMode="decimal"
                value={fee}
                onChange={(e) => setFee(e.target.value)}
                placeholder="0"
                className="num h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="date">Ngày mua</Label>
              <Input
                id="date"
                type="date"
                required
                value={date}
                max={todayKey()}
                onChange={(e) => setDate(e.target.value)}
                className="h-11"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="note">Ghi chú</Label>
            <Textarea
              id="note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Không bắt buộc"
            />
          </div>
          <div className="flex items-center justify-between rounded-lg bg-surface-raised px-4 py-3 text-sm">
            <span className="text-muted-foreground">Tổng chi</span>
            <span className="num font-semibold">
              {total != null ? formatMoney(total, cur) : "—"}
            </span>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Huỷ
            </Button>
            <Button type="submit" variant="hero" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />}
              {existing ? "Lưu thay đổi" : "Ghi nhận"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
