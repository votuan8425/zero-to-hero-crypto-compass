/**
 * Màn hình chờ lúc mở app: logo + vòng xoay tròn, hiện ít nhất 2 giây
 * trong khi dữ liệu của tài khoản đang được tải, rồi mới vào app.
 */
export function SplashScreen({ status }: { status?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="relative grid h-28 w-28 place-items-center">
        <span
          aria-hidden
          className="absolute inset-0 animate-spin rounded-full border-[3px] border-border border-t-primary"
        />
        <span className="lime-gradient grid h-16 w-16 place-items-center rounded-2xl text-2xl font-black text-primary-foreground">
          0→H
        </span>
      </div>
      <div className="mt-6 text-xl font-bold tracking-tight">
        ZERO <span className="text-muted-foreground">TO</span> HERO
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Tích sản đều đặn. Từ Zero đến Hero.
      </p>
      <p className="mt-8 animate-pulse text-sm text-muted-foreground">
        {status ?? "Đang tải dữ liệu…"}
      </p>
    </div>
  );
}
