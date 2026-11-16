import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandMark } from "@/components/app/brand";
import { translateAuthError } from "@/lib/auth-errors";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Đặt lại mật khẩu — ZERO TO HERO" },
      { name: "description", content: "Tạo mật khẩu mới cho tài khoản ZERO TO HERO." },
      { property: "og:title", content: "Đặt lại mật khẩu — ZERO TO HERO" },
      { property: "og:description", content: "Tạo mật khẩu mới cho tài khoản của bạn." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const isRecovery = window.location.hash.includes("type=recovery");
    const { data } = supabase.auth.onAuthStateChange((event) => { if (event === "PASSWORD_RECOVERY") setReady(true); });
    supabase.auth.getSession().then(({ data: s }) => { if (s.session && isRecovery) setReady(true); else if (s.session) setReady(true); });
    return () => data.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { toast.error("Hai mật khẩu không khớp."); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) { toast.error(translateAuthError(error)); return; }
    toast.success("Đã đặt lại mật khẩu thành công.");
    void navigate({ to: "/trang-chu", replace: true });
  }

  return (
    <div className="hero-glow flex min-h-screen flex-col items-center justify-center px-4">
      <div className="mb-8"><BrandMark className="text-lg" /></div>
      <div className="panel w-full max-w-md p-6 sm:p-8">
        <h1 className="text-xl font-bold">Đặt lại mật khẩu</h1>
        {!ready ? (
          <p className="mt-3 text-sm text-muted-foreground">Đang xác minh liên kết… Nếu trang không tiếp tục, liên kết có thể đã hết hạn — hãy yêu cầu liên kết mới từ trang đăng nhập.</p>
        ) : (
          <form onSubmit={submit} className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="pw">Mật khẩu mới</Label>
              <Input id="pw" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pw2">Nhập lại mật khẩu mới</Label>
              <Input id="pw2" type="password" required minLength={6} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
            </div>
            <Button type="submit" variant="hero" className="h-11 w-full" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />} Lưu mật khẩu mới
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
