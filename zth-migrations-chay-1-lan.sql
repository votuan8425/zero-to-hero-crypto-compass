-- ============================================================
-- ZERO TO HERO — Chạy 1 lần trong Supabase SQL editor
-- (Dashboard → SQL Editor → New query → dán toàn bộ → Run)
-- Gồm migration 0002 + 0003 + 0004 + 0005, theo đúng thứ tự.
-- An toàn chạy lại: các lệnh dùng IF NOT EXISTS nên chạy lại
-- cũng không lỗi (trừ CREATE TABLE đã đổi sang IF NOT EXISTS).
-- ============================================================

-- ---------- 0002: bảng admin_allocations (Tham khảo) ----------
CREATE TABLE IF NOT EXISTS public.admin_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  slices jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_allocations_user_idx ON public.admin_allocations (user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_allocations TO authenticated;
GRANT ALL ON public.admin_allocations TO service_role;
ALTER TABLE public.admin_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin allocation select all" ON public.admin_allocations;
CREATE POLICY "admin allocation select all" ON public.admin_allocations
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "admin allocation insert own" ON public.admin_allocations;
CREATE POLICY "admin allocation insert own" ON public.admin_allocations
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND (auth.jwt() ->> 'email') = 'yuntuan1309@gmail.com');

DROP POLICY IF EXISTS "admin allocation update own" ON public.admin_allocations;
CREATE POLICY "admin allocation update own" ON public.admin_allocations
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND (auth.jwt() ->> 'email') = 'yuntuan1309@gmail.com')
  WITH CHECK (auth.uid() = user_id AND (auth.jwt() ->> 'email') = 'yuntuan1309@gmail.com');

DROP POLICY IF EXISTS "admin allocation delete own" ON public.admin_allocations;
CREATE POLICY "admin allocation delete own" ON public.admin_allocations
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND (auth.jwt() ->> 'email') = 'yuntuan1309@gmail.com');

DROP TRIGGER IF EXISTS admin_allocations_updated_at ON public.admin_allocations;
CREATE TRIGGER admin_allocations_updated_at BEFORE UPDATE ON public.admin_allocations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- 0003: cột stats (ngày bắt đầu + lãi/lỗ %) ----------
ALTER TABLE public.admin_allocations ADD COLUMN IF NOT EXISTS started_at date;
ALTER TABLE public.admin_allocations ADD COLUMN IF NOT EXISTS pnl_pct numeric;

-- ---------- 0004: tiền tệ USDT/KRW (sửa lỗi không lưu được hồ sơ) ----------
-- THỨ TỰ QUAN TRỌNG: phải DROP CHECK cũ TRƯỚC khi UPDATE, vì CHECK cũ chỉ
-- cho VND/USD — UPDATE USD→USDT mà chạy trước sẽ bị CHECK cũ chặn lại.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_currency_check;
UPDATE public.profiles SET currency = 'USDT' WHERE currency = 'USD';
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_currency_check CHECK (currency IN ('VND', 'USDT', 'KRW'));

-- ---------- 0005: cột lời nhắn ----------
ALTER TABLE public.admin_allocations ADD COLUMN IF NOT EXISTS message text;
ALTER TABLE public.admin_allocations ADD COLUMN IF NOT EXISTS message_updated_at timestamptz;
