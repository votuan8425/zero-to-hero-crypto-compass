/**
 * Thẻ hỏi mềm bật thông báo đẩy: hiện sau khi user vừa follow 1 admin
 * (đúng lúc có lý do), giải thích trước rồi mới gọi hộp xin quyền thật
 * của trình duyệt. Tối đa hiện 2 lần, mỗi lần cách nhau ít nhất 1 ngày.
 */
import { useState } from "react";
import { BellRing, X } from "lucide-react";
import { toast } from "sonner";
import {
  getPushPermission,
  isPushSupported,
  readSoftAskState,
  recordSoftAsk,
  shouldShowSoftAsk,
  subscribePush,
} from "@/lib/push";

export function usePushSoftAsk() {
  const [visible, setVisible] = useState(false);

  function maybeShow() {
    if (!isPushSupported()) return;
    const state = readSoftAskState();
    if (
      shouldShowSoftAsk({
        permission: getPushPermission(),
        askedCount: state.askedCount,
        lastAskedAt: state.lastAskedAt,
        now: Date.now(),
      })
    ) {
      setVisible(true);
    }
  }

  function dismiss() {
    recordSoftAsk();
    setVisible(false);
  }

  return { visible, maybeShow, dismiss, setVisible };
}

export function PushOptInCard({
  onClose,
}: {
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function enable() {
    setBusy(true);
    try {
      const result = await subscribePush();
      if (result === "subscribed" || result === "already") {
        toast.success("Đã bật thông báo — admin cập nhật là bạn nhận được ngay.");
        recordSoftAsk();
        onClose();
      } else if (result === "denied") {
        toast.error(
          "Bạn đã chặn quyền thông báo. Mở cài đặt trình duyệt của trang này để bật lại.",
        );
        recordSoftAsk();
        onClose();
      } else if (result === "no-key") {
        toast.error("Máy chủ chưa cấu hình nhận thông báo đẩy. Thông báo trong app vẫn hoạt động.");
        onClose();
      } else {
        toast.error("Không bật được thông báo. Vui lòng thử lại.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel mb-5 flex items-start gap-3 border-primary/30 bg-primary/5 px-4 py-3.5">
      <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Nhận thông báo khi admin cập nhật?</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
          Bật thông báo trình duyệt để nhận báo ngay cả khi không mở app — trên Chrome,
          Safari và cả khi đã cài app về màn hình chính.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void enable()}
            className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60"
          >
            {busy ? "Đang bật…" : "Bật thông báo"}
          </button>
          <button
            type="button"
            onClick={() => {
              recordSoftAsk();
              onClose();
            }}
            className="rounded-full border border-border px-4 py-1.5 text-xs font-semibold hover:bg-surface-raised"
          >
            Để sau
          </button>
        </div>
      </div>
      <button
        type="button"
        aria-label="Đóng"
        onClick={() => {
          recordSoftAsk();
          onClose();
        }}
        className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-surface-raised"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
