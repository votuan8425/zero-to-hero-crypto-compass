-- Danh mục của nhà đầu tư chỉ đọc được bởi chính họ hoặc người đã được duyệt theo dõi.
DROP POLICY IF EXISTS "admin allocation select all" ON public.admin_allocations;

CREATE POLICY "admin allocation select owner or approved follower"
ON public.admin_allocations
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.investor_follows f
    WHERE f.investor_id = admin_allocations.user_id
      AND f.follower_id = auth.uid()
      AND f.status = 'approved'
  )
);

-- Người theo dõi không được tự đặt trạng thái "đã duyệt" khi gửi yêu cầu.
DROP POLICY IF EXISTS "investor follow insert own" ON public.investor_follows;
CREATE POLICY "investor follow insert own"
ON public.investor_follows
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = follower_id AND status = 'pending');

-- Danh sách công khai tối thiểu (chỉ ai đã đăng + lúc cập nhật) để hiện thẻ khóa
-- và nút xin theo dõi; không trả về tỷ lệ, lãi/lỗ hay lời nhắn.
CREATE OR REPLACE FUNCTION public.list_published_investors()
RETURNS TABLE (user_id uuid, updated_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT a.user_id, a.updated_at
  FROM public.admin_allocations a
  WHERE auth.uid() IS NOT NULL
  ORDER BY a.updated_at DESC
$$;

REVOKE ALL ON FUNCTION public.list_published_investors() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_published_investors() TO authenticated;