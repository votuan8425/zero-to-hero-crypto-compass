import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isNetworkError, profileQuery, transactionsQuery } from "@/lib/data";
import { SplashScreen } from "@/components/app/splash-screen";

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Đường dẫn gốc "/" không còn là trang giới thiệu nữa: mở web là vào
 * thẳng ứng dụng — nhưng qua màn hình chờ ít nhất 2 giây với vòng xoay
 * tròn, trong lúc dữ liệu của tài khoản (phiên + giao dịch + hồ sơ)
 * được tải xong rồi mới vào Trang chủ (đã đăng nhập) hoặc trang đăng
 * nhập (chưa có phiên). Tải dữ liệu tối đa 8 giây: quá hạn vẫn vào app
 * để trang trong tự hiện trạng thái tải/lỗi của nó, không kẹt ở màn chờ.
 */
export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [{ title: "ZERO TO HERO — Tích sản tiền mã hoá, đồng bộ mọi thiết bị" }],
  }),
  component: RootRedirect,
});

function RootRedirect() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    let cancelled = false;
    const boot = async () => {
      const minWait = sleep(2000);
      // 1. Kiểm tra phiên (giống _authenticated, ngoại tuyến tin phiên local).
      let userId: string | null = null;
      const { data, error } = await supabase.auth.getUser();
      if (data.user) {
        userId = data.user.id;
      } else if (error && isNetworkError(error)) {
        const { data: s } = await supabase.auth.getSession();
        if (s.session) userId = s.session.user.id;
      }
      // 2. Tải trước dữ liệu của tài khoản (tối đa 8 giây).
      if (userId) {
        await Promise.race([
          Promise.allSettled([
            queryClient.prefetchQuery(transactionsQuery(userId)),
            queryClient.prefetchQuery(profileQuery(userId)),
          ]),
          sleep(8000),
        ]);
      }
      // 3. Chờ đủ ít nhất 2 giây rồi mới vào app.
      await minWait;
      if (cancelled) return;
      void navigate({ to: userId ? "/trang-chu" : "/auth", replace: true });
    };
    void boot();
    return () => {
      cancelled = true;
    };
  }, [navigate, queryClient]);

  return <SplashScreen />;
}
