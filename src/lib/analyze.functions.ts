import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const REFERENCE_BUCKET = "reference-images";
const MAX_IMAGES = 6;

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk)
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(bin);
}

function mimeFor(path: string, type: string | undefined): string {
  if (type && type.startsWith("image/")) return type;
  const ext = path.split(".").pop()?.toLowerCase();
  return ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
}

export type AnalyzeResult =
  | { ok: true; data: import("./ai/portfolio-vision.server").Extraction }
  | { ok: false; status: number; message: string };

/** Reads the signed-in user's own uploaded screenshots and extracts the portfolio with AI. */
export const analyzePortfolioImages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { paths: string[] }) => {
    const paths = Array.isArray(input?.paths) ? input.paths.map(String).slice(0, MAX_IMAGES) : [];
    if (paths.length === 0) throw new Error("Chưa có ảnh nào để phân tích.");
    return { paths };
  })
  .handler(async ({ data, context }): Promise<AnalyzeResult> => {
    const { supabase, userId } = context;
    for (const p of data.paths) {
      if (!p.startsWith(`${userId}/`))
        return { ok: false, status: 403, message: "Bạn không có quyền truy cập ảnh này." };
    }
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { ok: false, status: 500, message: "Tính năng AI chưa được cấu hình." };

    const images: { dataUrl: string }[] = [];
    for (const p of data.paths) {
      const { data: blob, error } = await supabase.storage.from(REFERENCE_BUCKET).download(p);
      if (error || !blob)
        return {
          ok: false,
          status: 404,
          message: "Không đọc được ảnh đã tải lên. Vui lòng tải lại ảnh.",
        };
      images.push({
        dataUrl: `data:${mimeFor(p, blob.type)};base64,${toBase64(await blob.arrayBuffer())}`,
      });
    }

    try {
      const { extractPortfolio } = await import("./ai/portfolio-vision.server");
      const result = await extractPortfolio(images, apiKey);
      return { ok: true, data: result };
    } catch (e) {
      const status = (e as { statusCode?: number })?.statusCode ?? 500;
      console.error("AI extraction failed", status, e);
      const message =
        status === 429
          ? "Hệ thống AI đang quá tải. Vui lòng thử lại sau ít phút."
          : status === 402
            ? "Đã hết hạn mức AI của không gian làm việc. Vui lòng nạp thêm để tiếp tục phân tích."
            : status === 403
              ? "Yêu cầu phân tích bị từ chối."
              : "AI không phân tích được ảnh này. Bạn có thể nhập dữ liệu thủ công.";
      return { ok: false, status, message };
    }
  });
