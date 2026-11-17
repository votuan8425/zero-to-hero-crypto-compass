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
import { COINS, getCoin } from "@/lib/coins";
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
  const rate = prices.data?.usdVnd ?? null;

  useEffect(() => {
    if (!open) return;
    setCur(defaultCurrency);
    if (existing) {
      const r = defaultCurrency === "VND" && rate ? rate : 1;
      const useCur: Currency = defaultCurrency === "VND" && rate ? "VND" : "USD";
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

  const toUsd = useMemo(
    () => (v: number) => (cur === "USD" ? v : rate ? v / rate : NaN),
    [cur, rate],
  );

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
    if (cur === "VND" && !rate) {
      toast.error("Chưa có tỷ giá USD/VND. Vui lòng nhập giá bằng USD hoặc thử lại khi có mạng.");
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
            <Label>Đồng coin</Label>
            <Select value={symbol} onValueChange={setSymbol}>
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {COINS.map((c) => (
                  <SelectItem key={c.symbol} value={c.symbol}>
                    <span className="flex items-center gap-2">
                      <CoinLogo symbol={c.symbol} size={18} /> {c.name} ({c.symbol})
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qty">Số lượng {symbol}</Label>
            <Input
              id="qty"
              inputMode="decimal"
              required
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="Ví dụ: 0,005"
              className="num h-11"
            />
            {getCoin(symbol)?.unit === "ounce" && (
              <p className="text-xs text-muted-foreground">
                Số lượng tính theo ounce — 1 {symbol} ≈ 1 ounce{" "}
                {getCoin(symbol)?.name.toLowerCase()}.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="price">Giá mua mỗi {symbol}</Label>
              <ToggleGroup
                type="single"
                size="sm"
                value={cur}
                onValueChange={(v) => v && setCur(v as Currency)}
              >
                <ToggleGroupItem value="VND" className="h-7 px-2.5 text-xs">
                  VND
                </ToggleGroupItem>
                <ToggleGroupItem value="USD" className="h-7 px-2.5 text-xs">
                  USD
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
                placeholder={cur === "VND" ? "Ví dụ: 1650000000" : "Ví dụ: 64000"}
                className="num h-11"
              />
              <Button
                type="button"
                variant="surface"
                className="h-11 shrink-0"
                disabled={!live}
                onClick={() =>
                  live && setPrice(String(cur === "USD" ? live.usd : Math.round(live.vnd)))
                }
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
