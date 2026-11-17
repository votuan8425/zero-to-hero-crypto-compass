-- Theo dõi nhà đầu tư có duyệt (tab Tham khảo): người dùng gửi yêu cầu theo
-- dõi một nhà đầu tư (admin); admin duyệt thì mới được xem biểu đồ danh mục.
-- Trước khi duyệt, người dùng chỉ thấy tên + thống kê chung, KHÔNG thấy chart.
-- Chạy qua Lovable query_database (như migration 0002–0005).
--
-- Trạng thái: 'pending' (đang chờ duyệt), 'approved' (đã duyệt, được xem
-- chart), 'rejected' (bị từ chối, có thể gửi lại yêu cầu mới).
-- Một người chỉ có 1 yêu cầu cho 1 nhà đầu tư (UNIQUE investor+follower);
-- gửi lại sau khi bị từ chối sẽ cập nhật lại thành 'pending'.

CREATE TABLE IF NOT EXISTS public.investor_follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id uuid NOT NULL,
  follower_id uuid NOT NULL,
  -- Tên hiển thị của người gửi (lưu kèm để admin biết ai đang xin theo dõi;
  -- bảng profiles chỉ cho xem profile của chính mình nên không đọc được tên
  -- người khác qua đó).
  follower_name text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (investor_id, follower_id)
);
CREATE INDEX IF NOT EXISTS investor_follows_investor_idx ON public.investor_follows (investor_id);
CREATE INDEX IF NOT EXISTS investor_follows_follower_idx ON public.investor_follows (follower_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.investor_follows TO authenticated;
GRANT ALL ON public.investor_follows TO service_role;
ALTER TABLE public.investor_follows ENABLE ROW LEVEL SECURITY;

-- Người liên quan (người theo dõi hoặc nhà đầu tư) được xem yêu cầu.
CREATE POLICY "investor follow select involved" ON public.investor_follows
  FOR SELECT TO authenticated
  USING (auth.uid() = follower_id OR auth.uid() = investor_id);

-- Ai cũng có thể gửi yêu cầu theo dõi, nhưng chỉ cho chính mình.
CREATE POLICY "investor follow insert own" ON public.investor_follows
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = follower_id);

-- Chỉ nhà đầu tư được duyệt / từ chối yêu cầu gửi tới mình.
CREATE POLICY "investor follow update investor" ON public.investor_follows
  FOR UPDATE TO authenticated
  USING (auth.uid() = investor_id)
  WITH CHECK (auth.uid() = investor_id);

-- Người theo dõi được hủy yêu cầu của mình; nhà đầu tư được gỡ người theo dõi.
CREATE POLICY "investor follow delete involved" ON public.investor_follows
  FOR DELETE TO authenticated
  USING (auth.uid() = follower_id OR auth.uid() = investor_id);

DROP TRIGGER IF EXISTS investor_follows_updated_at ON public.investor_follows;
CREATE TRIGGER investor_follows_updated_at BEFORE UPDATE ON public.investor_follows
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.investor_follows;
