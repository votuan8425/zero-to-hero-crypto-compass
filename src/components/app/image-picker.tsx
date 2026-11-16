import { useRef } from "react";
import { Camera, ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/lib/data";

export interface PickedImage {
  key: string;
  file?: File;
  previewUrl: string;
  path?: string;
}

const MAX_FILES = 6;

export function ImagePicker({ images, onAdd, onRemove, disabled }: { images: PickedImage[]; onAdd: (imgs: PickedImage[]) => void; onRemove: (img: PickedImage) => void; disabled?: boolean }) {
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  function handle(files: FileList | null) {
    if (!files) return;
    const accepted: PickedImage[] = [];
    for (const f of Array.from(files)) {
      if (!ALLOWED_IMAGE_TYPES.includes(f.type)) { toast.error(`“${f.name}” không đúng định dạng. Chỉ hỗ trợ JPG, JPEG, PNG, WEBP.`); continue; }
      if (f.size > MAX_IMAGE_BYTES) { toast.error(`“${f.name}” lớn hơn 10 MB.`); continue; }
      accepted.push({ key: crypto.randomUUID(), file: f, previewUrl: URL.createObjectURL(f) });
    }
    const room = MAX_FILES - images.length;
    if (accepted.length > room) toast.warning(`Tối đa ${MAX_FILES} ảnh cho mỗi danh mục.`);
    if (accepted.length) onAdd(accepted.slice(0, Math.max(0, room)));
    if (galleryRef.current) galleryRef.current.value = "";
    if (cameraRef.current) cameraRef.current.value = "";
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-2 sm:flex">
        <Button type="button" variant="surface" className="h-11" disabled={disabled || images.length >= MAX_FILES} onClick={() => galleryRef.current?.click()}><ImagePlus /> Chọn từ thư viện</Button>
        <Button type="button" variant="surface" className="h-11" disabled={disabled || images.length >= MAX_FILES} onClick={() => cameraRef.current?.click()}><Camera /> Chụp ảnh</Button>
      </div>
      <input ref={galleryRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => handle(e.target.files)} />
      <input ref={cameraRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={(e) => handle(e.target.files)} />
      <p className="mt-2 text-xs text-muted-foreground">JPG, JPEG, PNG, WEBP · tối đa 10 MB mỗi ảnh · tối đa {MAX_FILES} ảnh.</p>
      {images.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {images.map((img) => (
            <div key={img.key} className="relative aspect-[3/4] overflow-hidden rounded-lg border border-border bg-surface-raised">
              <img src={img.previewUrl} alt="Ảnh danh mục đã chọn" className="h-full w-full object-cover" />
              <button type="button" aria-label="Xoá ảnh" disabled={disabled} onClick={() => onRemove(img)} className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-background/80 text-foreground backdrop-blur hover:bg-destructive">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
