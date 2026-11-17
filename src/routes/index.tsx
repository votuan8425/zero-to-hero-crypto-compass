import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { isNetworkError } from "@/lib/data";

/**
 * Đường dẫn gốc "/" không còn là trang giới thiệu nữa: mở web là vào
 * thẳng ứng dụng. Có phiên đăng nhập lưu sẵn thì về Trang chủ, chưa có
 * thì về trang đăng nhập.
 *
 * Chuyển hướng chạy trong beforeLoad (và route này chỉ chạy phía client,
 * ssr: false) nên trang giới thiệu không bao giờ nháy lên trước khi
 * chuyển. Kiểm tra phiên giống _authenticated: getUser() trước, ngoại
 * tuyến thì tin phiên lưu local (getSession()).
 */
export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: "/trang-chu" });
    // Ngoại tuyến: tin phiên lưu trên thiết bị để vào thẳng ứng dụng.
    if (error && isNetworkError(error)) {
      const { data: s } = await supabase.auth.getSession();
      if (s.session) throw redirect({ to: "/trang-chu" });
    }
    throw redirect({ to: "/auth" });
  },
  head: () => ({
    meta: [{ title: "ZERO TO HERO — Tích sản tiền mã hoá, đồng bộ mọi thiết bị" }],
  }),
  component: RootRedirect,
});

function RootRedirect() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <p className="text-sm text-muted-foreground">Đang chuyển hướng…</p>
    </div>
  );
}
