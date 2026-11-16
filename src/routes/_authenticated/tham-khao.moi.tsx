import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2, PencilLine, Save, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/app/app-shell";
import { ImagePicker, type PickedImage } from "@/components/app/image-picker";
import { HoldingsEditor, emptyHolding } from "@/components/app/holdings-editor";
import { ReferenceAnalysis } from "@/components/app/reference-analysis";
import { useSync } from "@/components/app/sync-provider";
import { useUser } from "@/hooks/use-user";
import { useReferences } from "@/hooks/use-app-data";
import { analyzePortfolioImages } from "@/lib/analyze.functions";
import { createReference, refsKey, removeReferenceImages, uploadReferenceImage } from "@/lib/data";
import { checkPercentSum, fillPercentFromValues, normalizeHoldings, type RefHolding } from "@/lib/reference";

export const Route = createFileRoute("/_authenticated/tham-khao/moi")({
  head: () => ({
    meta: [
      { title: "Thêm danh mục tham khảo — ZERO TO HERO" },
      { name: "description", content: "Tải ảnh chụp danh mục, AI trích xuất coin và tỷ lệ phân bổ." },
      { property: "og:title", content: "Thêm danh mục tham khảo — ZERO TO HERO" },
      { property: "og:description", content: "Phân tích ảnh danh mục tiền mã hoá bằng AI." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NewReferencePage,
});

function NewReferencePage() {
  const user = useUser();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { online } = useSync();
  const refs = useReferences();
  const analyze = useServerFn(analyzePortfolioImages);
  const [images, setImages] = useState<PickedImage[]>([]);
  const [stage, setStage] = useState<"pick" | "analyzing" | "review">("pick");
  const [holdings, setHoldings] = useState<RefHolding[]>([]);
  const [totalValue, setTotalValue] = useState<number | null>(null);
  const [totalCurrency, setTotalCurrency] = useState<string | null>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiNotes, setAiNotes] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const uploaded = useRef<Set<string>>(new Set());
  const saved = useRef(false);

  useEffect(() => {
    if (!name && refs.data) setName(`Tham khảo ${String(refs.data.length + 1).padStart(2, "0")}`);
  }, [refs.data, name]);

  // Remove uploaded screenshots if the user leaves without saving.
  useEffect(() => () => {
    if (!saved.current && uploaded.current.size) void removeReferenceImages([...uploaded.current]);
  }, []);

  async function ensureUploaded(): Promise<string[]> {
    const next = [...images];
    for (const img of next) {
      if (!img.path && img.file) {
        img.path = await uploadReferenceImage(user.id, img.file);
        uploaded.current.add(img.path);
      }
    }
    setImages(next);
    return next.map((i) => i.path!).filter(Boolean);
  }

  async function runAnalysis() {
    if (!online) return toast.error("Cần kết nối mạng để phân tích bằng AI.");
    if (!images.length) return toast.error("Hãy chọn ít nhất một ảnh.");
    setStage("analyzing");
    try {
      const paths = await ensureUploaded();
      const res = await analyze({ data: { paths } });
      if (!res.ok) { toast.error(res.message); setStage("pick"); return; }
      const d = res.data;
      if (!d.is_portfolio || d.holdings.length === 0) {
        toast.warning("AI không nhận diện được danh mục tiền mã hoá trong ảnh. Bạn có thể nhập thủ công.");
      }
      setHoldings(normalizeHoldings(fillPercentFromValues(d.holdings as RefHolding[])));
      setTotalValue(d.total_value);
      setTotalCurrency(d.total_value_currency);
      setAiSummary(d.summary || null);
      setAiNotes(d.unreadable_notes || null);
      setConfirmed(false);
      setStage("review");
    } catch (e) {
      console.error(e);
      toast.error("Không phân tích được ảnh. Vui lòng thử lại.");
      setStage("pick");
    }
  }

  function manualEntry() {
    setHoldings([emptyHolding("BTC"), emptyHolding("ETH")]);
    setAiSummary(null); setAiNotes(null);
    setStage("review");
  }

  async function removeImage(img: PickedImage) {
    setImages((prev) => prev.filter((i) => i.key !== img.key));
    if (img.path) { uploaded.current.delete(img.path); await removeReferenceImages([img.path]); }
  }

  const check = checkPercentSum(holdings);
  const canSave = name.trim().length > 0 && holdings.length > 0 && holdings.every((h) => h.symbol) && (check.ok || confirmed);

  async function save() {
    if (!canSave) return;
    setSaving(true);
    try {
      const paths = await ensureUploaded();
      const id = await createReference(user.id, {
        name: name.trim(), description: description.trim() || null, notes: notes.trim() || null, image_paths: paths,
        holdings: normalizeHoldings(holdings), total_value: totalValue, total_value_currency: totalCurrency, ai_summary: aiSummary,
      });
      saved.current = true;
      await qc.invalidateQueries({ queryKey: refsKey(user.id) });
      toast.success("Đã lưu danh mục tham khảo.");
      void navigate({ to: "/tham-khao/$id", params: { id } });
    } catch (e) {
      console.error(e);
      toast.error("Không lưu được danh mục. Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <Link to="/tham-khao" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Tham khảo</Link>
      <PageHeader title="Thêm danh mục tham khảo" subtitle="Tải ảnh chụp danh mục — AI sẽ đọc tên coin, tỷ lệ, số lượng và giá trị." />

      <section className="panel p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider">1. Ảnh chụp danh mục</h2>
        <ImagePicker images={images} onAdd={(n) => setImages((p) => [...p, ...n])} onRemove={(i) => void removeImage(i)} disabled={stage === "analyzing" || saving} />
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="hero" disabled={!images.length || stage === "analyzing"} onClick={() => void runAnalysis()}>
            {stage === "analyzing" ? <Loader2 className="animate-spin" /> : <Sparkles />} {stage === "analyzing" ? "AI đang phân tích…" : stage === "review" ? "Phân tích lại" : "Phân tích bằng AI"}
          </Button>
          {stage !== "review" && <Button variant="ghost" onClick={manualEntry}><PencilLine /> Nhập thủ công</Button>}
        </div>
        {stage === "analyzing" && <p className="mt-3 text-sm text-muted-foreground">Đang nhận diện coin và tỷ lệ phân bổ. Việc này có thể mất 10–40 giây.</p>}
      </section>

      {stage === "review" && (
        <>
          {(aiSummary || aiNotes) && (
            <section className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">
              <div className="mb-1 flex items-center gap-2 font-semibold text-primary"><Sparkles className="h-4 w-4" /> Kết quả từ AI</div>
              {aiSummary && <p>{aiSummary}</p>}
              {aiNotes && <p className="mt-2 text-warning">Không xác định được: {aiNotes}</p>}
              <p className="mt-2 text-xs text-muted-foreground">Nhãn “Trích xuất từ ảnh” là số đọc trực tiếp; “AI ước tính” là số AI tính từ dữ liệu khác trong ảnh; “Không xác định” là không đọc được. Hãy kiểm tra lại trước khi lưu.</p>
            </section>
          )}

          <section className="panel mt-4 p-5">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider">2. Kiểm tra & chỉnh sửa dữ liệu</h2>
            <HoldingsEditor holdings={holdings} onChange={(h) => { setHoldings(h); setConfirmed(false); }} />
          </section>

          {holdings.some((h) => h.percent != null) && (
            <div className="mt-4"><ReferenceAnalysis holdings={holdings} totalValue={totalValue} totalCurrency={totalCurrency} /></div>
          )}

          <section className="panel mt-4 space-y-4 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wider">3. Lưu danh mục</h2>
            <div className="space-y-1.5"><Label htmlFor="rn">Tên danh mục</Label><Input id="rn" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ví dụ: Portfolio của nhà đầu tư A" /></div>
            <div className="space-y-1.5"><Label htmlFor="rd">Mô tả (không bắt buộc)</Label><Input id="rd" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ví dụ: Danh mục dài hạn" /></div>
            <div className="space-y-1.5"><Label htmlFor="rno">Ghi chú cá nhân</Label><Textarea id="rno" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Suy nghĩ của bạn về danh mục này…" /></div>
            {!check.ok && holdings.length > 0 && (
              <label className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
                <Checkbox checked={confirmed} onCheckedChange={(v) => setConfirmed(v === true)} className="mt-0.5" />
                Tôi đã kiểm tra với ảnh gốc và xác nhận lưu dữ liệu này dù tổng tỷ lệ không bằng 100%.
              </label>
            )}
            <Button variant="hero" disabled={!canSave || saving || !online} onClick={() => void save()}>
              {saving ? <Loader2 className="animate-spin" /> : <Save />} Lưu danh mục tham khảo
            </Button>
            {!online && <p className="text-xs text-warning">Cần kết nối mạng để lưu danh mục tham khảo.</p>}
          </section>
        </>
      )}
    </div>
  );
}
