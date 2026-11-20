-- Bảng "Hoạt động gần đây" cho tab Tham khảo.
-- Chạy qua Lovable (chat hoặc SQL editor), KHÔNG phải migration của Muse.
-- Chỉ lưu % và tên token — KHÔNG lưu số lượng, số tiền hay giá mua — nên
-- người theo dõi đã duyệt mới xem được mà không lộ thông tin riêng tư.
--
-- Quyền đọc: chính investor, hoặc follower đã được investor đó duyệt
-- (cùng điều kiện xem biểu đồ danh mục). Quyền ghi: chỉ chính investor.

CREATE TABLE IF NOT EXISTS public.admin_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('buy', 'sell', 'swap', 'update', 'message')),
  symbol text,
  to_symbol text,
  -- % so với số lượng đang nắm trước giao dịch (null khi mua lần đầu).
  pct double precision,
  -- Ảnh chụp phân bổ mới sau khi cập nhật portfolio (vd "ETH 81% · BTC 19%").
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_activities_user_created_idx
  ON public.admin_activities (user_id, created_at DESC);
GRANT SELECT, INSERT ON public.admin_activities TO authenticated;
GRANT ALL ON public.admin_activities TO service_role;
ALTER TABLE public.admin_activities ENABLE ROW LEVEL SECURITY;

-- Chỉ chính investor mới ghi được hành động của mình.
DROP POLICY IF EXISTS "admin activities insert own" ON public.admin_activities;
CREATE POLICY "admin activities insert own" ON public.admin_activities
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Đọc: chính investor, hoặc follower đã được duyệt theo dõi investor đó.
DROP POLICY IF EXISTS "admin activities select allowed" ON public.admin_activities;
CREATE POLICY "admin activities select allowed" ON public.admin_activities
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.investor_follows f
      WHERE f.investor_id = admin_activities.user_id
        AND f.follower_id = auth.uid()
        AND f.status = 'approved'
    )
  );