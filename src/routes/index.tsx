import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Đường dẫn gốc "/" chỉ là cửa vào: chuyển thẳng tới Trang chủ. Màn hình chờ
 * (ít nhất 2 giây, vòng xoay tròn) đã hiện ở RootComponent lúc mở app — dù
 * đã đăng nhập hay chưa — nên ở đây chỉ cần chuyển hướng, không chờ thêm.
 * Chưa đăng nhập thì layout _authenticated sẽ chuyển tiếp tới /auth.
 */
export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [{ title: "ZERO TO HERO — Tích sản tiền mã hoá, đồng bộ mọi thiết bị" }],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/trang-chu", replace: true });
  },
  component: () => null,
});
