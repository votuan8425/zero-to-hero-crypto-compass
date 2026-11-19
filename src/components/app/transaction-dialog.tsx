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
import { formatDateTime, formatMoney, todayKey, type Currency } from "@/lib/format";
import { metalAskPerUnit, metalBidPerUnit, normalizeMetalPurchase } from "@/lib/metals";
import type { Holding, Tx } from "@/lib/portfolio";
import { actionPercent, roundActionPercent } from "@/lib/swap";
import { logActivity } from "@/lib/activity";
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
  holdings,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  existing?: Tx | null;
  defaultCurrency: Currency;
  /** Số lượng đang nắm (để tính % mua thêm so với trước giao dịch). */
  holdings?: Holding[];
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
  /** Giao dịch đang sửa là một lần BÁN (số lượng âm, tạo từ đổi token). */
  const isSell = existing != null && existing.quantity < 0;
  /** Đơn vị mua vàng đã chọn (bạc luôn theo lượng). */
  const [metalUnit, setMetalUnit] = useState<"chỉ" | "lượng">("chỉ");
  const prices = usePrices();
  const usdVnd = prices.data?.usdVnd ?? null;
  const usdKrw = prices.data?.usdKrw ?? null;
  /** Số đơn vị tiền tệ tương ứng 1 USDT (USDT = 1). */
  const rateFor = (c: Currency): number | null => (c === "VND" ? usdVnd : c === "KRW" ? usdKrw : 1);

  useEffect(() => {
    if (!open) return;
    setCur(defaultCurrency);
    if (existing && getCoin(existing.symbol)?.unit) {
      // Vàng/bạc: luôn VND, ưu tiên giá VND chính xác đã lưu.
      const r = usdVnd ?? 0;
      setCur("VND");
      setMetalUnit("chỉ");
      setSymbol(existing.symbol);
      // Bán thì số lượng lưu âm — hiện giá trị tuyệt đối, lúc lưu sẽ gắn lại dấu trừ.
      setQty(String(Math.abs(existing.quantity)));
      const pv = existing.price_vnd ?? (r ? existing.price_usd * r : NaN);
      const fv = existing.fee_vnd ?? (r ? existing.fee_usd * r : 0);
      setPrice(Number.isFinite(pv) ? String(Math.round(pv)) : "");
      setFee(fv ? String(Math.round(fv)) : "");
      setDate(existing.tx_date);
      setNote(existing.note ?? "");
    } else if (existing) {
      const r = rateFor(defaultCurrency) ?? 1;
      const useCur: Currency = rateFor(defaultCurrency) ? defaultCurrency : "USDT";
      setCur(useCur);
      setSymbol(existing.symbol);
      // Bán thì số lượng lưu âm — hiện giá trị tuyệt đối, lúc lưu sẽ gắn lại dấu trừ.
      setQty(String(Math.abs(existing.quantity)));
      setPrice(String(Math.round(existing.price_usd * r * 1e6) / 1e6));
      setFee(existing.fee_usd ? String(Math.round(existing.fee_usd * r * 100) / 100) : "");
      setDate(existing.tx_date);
      setNote(existing.note ?? "");
    } else {
      if (getCoin(symbol)?.unit) {
        setCur("VND");
        if (symbol === "PAXG") setMetalUnit("chỉ");
      }
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
  const priceEmpty = price.trim() === "";
  const live = prices.data?.prices[symbol];
  const metal = getCoin(symbol)?.unit ? getCoin(symbol) : undefined;
  /** Đơn vị mua thực tế: vàng chọn chỉ/lượng, bạc cố định lượng. */
  const buyUnit: "chỉ" | "lượng" | null = metal
    ? metal.symbol === "PAXG"
      ? metalUnit
      : "lượng"
    : null;
  /** Giá hiện tại quy theo đơn vị tiền tệ đang chọn (vàng/bạc luôn VND, theo đơn vị mua). Bán thì dùng giá mua vào (bid), mua thì dùng giá bán ra (ask). */
  const livePriceInCur = useMemo(() => {
    if (!live) return null;
    if (metal && buyUnit) {
      return isSell
        ? metalBidPerUnit(live, metal.symbol, buyUnit)
        : metalAskPerUnit(live, metal.symbol, buyUnit);
    }
    const r = rateFor(cur);
    return r ? live.usd * r : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, metal, buyUnit, cur, usdVnd, usdKrw, isSell]);
  /** Giá thực dùng để lưu: nhập tay, hoặc giá hiện tại khi để trống. */
  const effP = priceEmpty ? livePriceInCur : p;
  const total =
    Number.isFinite(q) && effP != null && Number.isFinite(effP)
      ? q * effP + (Number.isFinite(f) ? f : 0)
      : null;
  const pricePlaceholder =
    metal && cur === "VND"
      ? buyUnit === "lượng"
        ? metal.symbol === "PAXG"
          ? "Ví dụ: 137200000"
          : "Ví dụ: 1598000"
        : "Ví dụ: 13720000"
      : cur === "VND"
        ? "Ví dụ: 1650000000"
        : cur === "KRW"
          ? "Ví dụ: 88000000"
          : "Ví dụ: 64000";

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
    if (!priceEmpty && (!Number.isFinite(p) || p < 0)) {
      toast.error("Giá mua không hợp lệ.");
      return;
    }
    if (effP == null || !Number.isFinite(effP) || effP < 0) {
      toast.error("Chưa có giá hiện tại, vui lòng nhập giá mua.");
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
      // Vàng mua theo lượng thì quy về chỉ để lưu chuẩn; bạc giữ nguyên lượng.
      const norm = metal
        ? normalizeMetalPurchase(symbol, q, effP, buyUnit ?? "chỉ")
        : { quantity: q, pricePerUnit: effP };
      // Để trống giá thì lấy giá hiện tại và ghi chú rõ để sau này biết.
      const autoNote = priceEmpty
        ? `Giá lấy theo giá hiện tại (${metal ? (metal.symbol === "PAXG" ? "SJC" : "Ancarat") : "giá thị trường"}${live?.updatedAt ? ` lúc ${formatDateTime(live.updatedAt)}` : prices.data?.fetchedAt ? ` lúc ${formatDateTime(prices.data.fetchedAt)}` : ""})`
        : null;
      const finalNote = [note.trim(), autoNote].filter(Boolean).join(" · ") || null;
      const status = await saveTransaction(
        qc,
        user.id,
        {
          symbol,
          coin_name: getCoin(symbol)?.name ?? symbol,
          // Bán thì số lượng lưu âm (giữ nguyên loại giao dịch khi sửa).
          quantity: isSell ? -norm.quantity : norm.quantity,
          price_usd: toUsd(norm.pricePerUnit),
          fee_usd: toUsd(f || 0),
          // Vàng/bạc luôn nhập bằng VND: lưu số VND chính xác (theo đơn vị lưu chuẩn).
          price_vnd: metal ? norm.pricePerUnit : null,
          fee_vnd: metal ? f || 0 : null,
          tx_date: date,
          note: finalNote,
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
      // Ghi nhật ký hành động (chỉ lần mua MỚI, không ghi khi sửa): % mua thêm
      // so với số lượng đang nắm trước giao dịch (mua lần đầu thì không có %).
      if (!existing) {
        const heldBefore = holdings?.find((h) => h.symbol === symbol)?.quantity ?? 0;
        const pct = actionPercent(norm.quantity, heldBefore);
        await logActivity({
          userId: user.id,
          type: "buy",
          symbol,
          pct: pct != null ? roundActionPercent(pct) : null,
        });
        await qc.invalidateQueries({ queryKey: ["admin-activities", user.id] });
      }
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
          <DialogTitle>
            {existing ? (isSell ? "Sửa giao dịch bán" : "Sửa giao dịch") : "Thêm lần tích sản"}
          </DialogTitle>
          <DialogDescription>
            {isSell
              ? "Sửa một lần bán/đổi — số lượng vẫn là số đã bán."
              : "Ghi lại một lần mua định kỳ (DCA)."}
          </DialogDescription>
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
                if (v === "PAXG") setMetalUnit("chỉ");
              }}
            >
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {COINS.map((c) => (
                  <SelectItem key={c.symbol} value={c.symbol}>
                    <span className="flex items-center gap-2">
                      <CoinLogo symbol={c.symbol} size={18} /> {c.name}
                      {c.unit ? "" : ` (${displaySymbol(c.symbol)})`}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="qty">Số lượng ({buyUnit ?? displaySymbol(symbol)})</Label>
              {metal?.symbol === "PAXG" && (
                <ToggleGroup
                  type="single"
                  size="sm"
                  value={metalUnit}
                  onValueChange={(v) => v && setMetalUnit(v as "chỉ" | "lượng")}
                >
                  <ToggleGroupItem value="chỉ" className="h-7 px-2.5 text-xs">
                    Chỉ
                  </ToggleGroupItem>
                  <ToggleGroupItem value="lượng" className="h-7 px-2.5 text-xs">
                    Lượng
                  </ToggleGroupItem>
                </ToggleGroup>
              )}
            </div>
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
                  ? "Vàng tính theo chỉ hoặc lượng (1 lượng = 10 chỉ), giá theo vàng SJC."
                  : "Bạc tính theo lượng, giá theo bạc Ancarat."}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="price">Giá mua mỗi {buyUnit ?? displaySymbol(symbol)}</Label>
              {metal ? (
                <span className="text-xs font-semibold text-muted-foreground">VND</span>
              ) : (
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
              )}
            </div>
            <div className="flex gap-2">
              <Input
                id="price"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder={pricePlaceholder}
                className="num h-11"
              />
              <Button
                type="button"
                variant="surface"
                className="h-11 shrink-0"
                disabled={livePriceInCur == null}
                onClick={() => {
                  if (livePriceInCur == null) return;
                  setPrice(
                    String(
                      cur === "USDT"
                        ? Math.round(livePriceInCur * 1e6) / 1e6
                        : Math.round(livePriceInCur),
                    ),
                  );
                }}
              >
                Giá hiện tại
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Để trống để lấy giá {metal ? "bán ra" : "thị trường"} hiện tại.
            </p>
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
            <span className="text-muted-foreground">
              Tổng chi{priceEmpty && livePriceInCur != null ? " (theo giá hiện tại)" : ""}
            </span>
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
