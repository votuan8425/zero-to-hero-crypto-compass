import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Info, Loader2, Pencil, Save, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/app/app-shell";
import { CoinLogo } from "@/components/app/coin-logo";
import { CompareChart } from "@/components/app/compare-chart";
import { HoldingsEditor } from "@/components/app/holdings-editor";
import { ReferenceAnalysis } from "@/components/app/reference-analysis";
import { usePortfolio, useReferences } from "@/hooks/use-app-data";
import { useUser } from "@/hooks/use-user";
import { deleteReference, refsKey, signedUrlsQuery, updateReference } from "@/lib/data";
import { checkPercentSum, compareAllocations, normalizeHoldings, type RefHolding } from "@/lib/reference";
import { displaySymbol } from "@/lib/coins";
import { formatDateTime, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/tham-khao/$id")({
  head: () => ({
    meta: [
      { title: "Chi tiết danh mục tham khảo — ZERO TO HERO" },
      { name: "description", content: "Phân tích, chỉnh sửa và so sánh danh mục tham khảo với danh mục của bạn." },
      { property: "og:title", content: "Danh mục tham khảo — ZERO TO HERO" },
      { property: "og:description", content: "Phân tích phân bổ danh mục tham khảo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ReferenceDetailPage,
});

function ReferenceDetailPage() {
  const { id } = Route.useParams();
  const user = useUser();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const refs = useReferences();
  const ref = refs.data?.find((r) => r.id === id);
  const images = useQuery(signedUrlsQuery(ref?.image_paths ?? []));
  const { allocation, holdings: myHoldings } = usePortfolio();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<RefHolding[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [askDelete, setAskDelete] = useState(false);

  useEffect(() => {
    if (ref && !editing) { setDraft(ref.holdings); setName(ref.name); setDescription(ref.description ?? ""); setNotes(ref.notes ?? ""); }
  }, [ref, editing]);

  const compare = useMemo(() => (ref ? compareAllocations(allocation.slices, ref.holdings) : []), [allocation.slices, ref]);

  if (refs.isLoading) return <Skeleton className="h-64" />;
  if (!ref) {
    return <EmptyState icon={<Info className="h-6 w-6" />} title="Không tìm thấy danh mục" description="Danh mục này không tồn tại hoặc đã bị xoá." action={<Button asChild variant="surface"><Link to="/tham-khao">Quay lại Tham khảo</Link></Button>} />;
  }

  const check = checkPercentSum(draft);

  async function save() {
    if (!ref) return;
    if (!name.trim()) { toast.error("Vui lòng nhập tên danh mục."); return; }
    if (!check.ok && !confirmed) { toast.error("Tổng tỷ lệ khác 100%. Hãy sửa hoặc xác nhận trước khi lưu."); return; }
    setSaving(true);
    try {
      await updateReference(ref.id, { name: name.trim(), description: description.trim() || null, notes: notes.trim() || null, holdings: normalizeHoldings(draft) });
      await qc.invalidateQueries({ queryKey: refsKey(user.id) });
      toast.success("Đã lưu thay đổi.");
      setEditing(false);
    } catch {
      toast.error("Không lưu được thay đổi. Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!ref) return;
    try {
      await deleteReference(ref);
      await qc.invalidateQueries({ queryKey: refsKey(user.id) });
      toast.success("Đã xoá danh mục tham khảo.");
      void navigate({ to: "/tham-khao" });
    } catch {
      toast.error("Không xoá được danh mục. Vui lòng thử lại.");
    }
  }

  return (
    <div>
      <Link to="/tham-khao" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Tham khảo</Link>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight md:text-3xl">{ref.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{ref.description ? `${ref.description} · ` : ""}Tải lên lúc {formatDateTime(ref.created_at)}</p>
        </div>
        <div className="flex gap-2">
          {editing ? (
            <Button variant="ghost" onClick={() => setEditing(false)}><X /> Huỷ</Button>
          ) : (
            <Button variant="surface" onClick={() => { setConfirmed(false); setEditing(true); }}><Pencil /> Chỉnh sửa</Button>
          )}
          <Button variant="ghost" className="text-muted-foreground hover:text-loss" aria-label="Xoá danh mục" onClick={() => setAskDelete(true)}><Trash2 /></Button>
        </div>
      </div>

      {editing ? (
        <section className="panel space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="en">Tên danh mục</Label><Input id="en" value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="ed">Mô tả</Label><Input id="ed" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          </div>
          <div className="space-y-1.5"><Label htmlFor="eno">Ghi chú cá nhân</Label><Textarea id="eno" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          <HoldingsEditor holdings={draft} onChange={(h) => { setDraft(h); setConfirmed(false); }} />
          {!check.ok && draft.length > 0 && (
            <label className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
              <Checkbox checked={confirmed} onCheckedChange={(v) => setConfirmed(v === true)} className="mt-0.5" />
              Tôi xác nhận lưu dữ liệu này dù tổng tỷ lệ không bằng 100%.
            </label>
          )}
          <Button variant="hero" disabled={saving} onClick={() => void save()}>{saving ? <Loader2 className="animate-spin" /> : <Save />} Lưu thay đổi</Button>
        </section>
      ) : (
        <Tabs defaultValue="phan-tich">
          <TabsList className="mb-4 w-full justify-start overflow-x-auto sm:w-auto">
            <TabsTrigger value="phan-tich">Phân tích</TabsTrigger>
            <TabsTrigger value="so-sanh">So với danh mục của tôi</TabsTrigger>
            <TabsTrigger value="anh">Ảnh gốc ({ref.image_paths.length})</TabsTrigger>
            <TabsTrigger value="ghi-chu">Ghi chú</TabsTrigger>
          </TabsList>

          <TabsContent value="phan-tich">
            {ref.ai_summary && <p className="mb-4 rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">{ref.ai_summary}</p>}
            <ReferenceAnalysis holdings={ref.holdings} totalValue={ref.total_value} totalCurrency={ref.total_value_currency} />
          </TabsContent>

          <TabsContent value="so-sanh">
            <div className="mb-4 flex gap-2 rounded-lg border border-border bg-surface p-3 text-xs text-muted-foreground">
              <Info className="h-4 w-4 shrink-0" />
              Chỉ để tham khảo. ZERO TO HERO không thay đổi tài sản của bạn và đây không phải khuyến nghị đầu tư.
            </div>
            {myHoldings.length === 0 ? (
              <EmptyState icon={<Info className="h-6 w-6" />} title="Bạn chưa có danh mục thật" description="Thêm giao dịch ở mục Tích sản để so sánh." action={<Button asChild variant="hero"><Link to="/tich-san">Đến Tích sản</Link></Button>} />
            ) : (
              <div className="space-y-4">
                <section className="panel p-5">
                  <CompareChart rows={compare.map((c) => ({ symbol: c.symbol, mine: c.mine, reference: c.reference }))} series={[{ key: "mine", label: "Danh mục của tôi" }, { key: "reference", label: ref.name }]} />
                  <p className="mt-2 text-xs text-muted-foreground">Danh mục của bạn tính {allocation.basis === "value" ? "theo giá trị hiện tại" : "theo vốn đã bỏ ra"}.</p>
                </section>
                <section className="panel overflow-x-auto">
                  <table className="w-full min-w-[420px] text-sm">
                    <thead><tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground"><th className="px-4 py-3 font-medium">Đồng coin</th><th className="px-4 py-3 text-right font-medium">Của tôi</th><th className="px-4 py-3 text-right font-medium">Tham khảo</th><th className="px-4 py-3 text-right font-medium">Chênh lệch</th></tr></thead>
                    <tbody className="divide-y divide-border">
                      {compare.map((c) => (
                        <tr key={c.symbol}>
                          <td className="px-4 py-3"><span className="flex items-center gap-2"><CoinLogo symbol={c.symbol} size={22} /> <b>{displaySymbol(c.symbol)}</b></span></td>
                          <td className="num px-4 py-3 text-right">{formatPercent(c.mine)}</td>
                          <td className="num px-4 py-3 text-right">{formatPercent(c.reference)}</td>
                          <td className={cn("num px-4 py-3 text-right", c.diff > 0 ? "text-gain" : c.diff < 0 ? "text-loss" : "text-muted-foreground")}>{formatPercent(c.diff, 2, true)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              </div>
            )}
          </TabsContent>

          <TabsContent value="anh">
            {ref.image_paths.length === 0 ? (
              <p className="text-sm text-muted-foreground">Danh mục này được nhập thủ công, không có ảnh.</p>
            ) : images.isLoading ? (
              <Skeleton className="h-64" />
            ) : (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {ref.image_paths.map((p) => images.data?.[p] ? (
                  <a key={p} href={images.data[p]} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-border">
                    <img src={images.data[p]} alt="Ảnh chụp danh mục gốc" loading="lazy" className="w-full object-contain" />
                  </a>
                ) : <div key={p} className="rounded-xl border border-border p-4 text-xs text-muted-foreground">Không tải được ảnh.</div>)}
              </div>
            )}
            <p className="mt-3 text-xs text-muted-foreground">Ảnh được lưu riêng tư; liên kết xem ảnh tự hết hạn sau 1 giờ.</p>
          </TabsContent>

          <TabsContent value="ghi-chu">
            <section className="panel p-5 text-sm">
              {ref.notes ? <p className="whitespace-pre-wrap">{ref.notes}</p> : <p className="text-muted-foreground">Chưa có ghi chú. Bấm “Chỉnh sửa” để thêm.</p>}
              <p className="mt-4 text-xs text-muted-foreground">Cập nhật lần cuối: {formatDateTime(ref.updated_at)}</p>
            </section>
          </TabsContent>
        </Tabs>
      )}

      <AlertDialog open={askDelete} onOpenChange={setAskDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá “{ref.name}”?</AlertDialogTitle>
            <AlertDialogDescription>Danh mục tham khảo và ảnh gốc sẽ bị xoá vĩnh viễn trên mọi thiết bị. Danh mục thật của bạn không bị ảnh hưởng.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction onClick={() => void remove()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Xoá</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
