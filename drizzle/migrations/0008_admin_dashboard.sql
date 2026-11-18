-- 0008: Dashboard quản trị — chỉ admin yuntuan1309@gmail.com được xem
-- danh sách tài khoản, sửa tên/tiền tệ và xóa tài khoản người khác.
--
-- Nguyên tắc: admin KHÔNG đọc trực tiếp bảng transactions/profiles của
-- người khác qua RLS (mỗi user chỉ thấy dữ liệu của mình). Mọi thao tác
-- đều qua 3 hàm SECURITY DEFINER dưới đây, mỗi hàm tự kiểm tra người gọi
-- có phải admin không rồi mới làm việc — client không có cách nào vượt
-- qua kiểm tra này.
--
-- Chạy qua Lovable (chat) hoặc Supabase SQL editor (như migration 0007).
-- Publish trong Lovable KHÔNG tự chạy migration mới từ GitHub.

-- Kiểm tra người gọi có phải admin không (dùng chung cho cả 3 hàm).
CREATE OR REPLACE FUNCTION public.is_admin_caller()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = auth.uid() AND lower(u.email) = 'yuntuan1309@gmail.com'
  )
$$;

REVOKE ALL ON FUNCTION public.is_admin_caller() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin_caller() TO authenticated;

-- Danh sách mọi tài khoản + số liệu gộp từ giao dịch của họ.
-- holdings: [{symbol, coin_name, quantity, invested_usd, invested_vnd}]
-- (invested_vnd null với coin thường — chỉ vàng/bạc mới có giá VND chính xác).
-- Giá trị hiện tại và % nắm giữ KHÔNG tính ở đây (cần giá live) — client
-- tính từ holdings + giá thị trường.
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  user_id uuid,
  email text,
  username text,
  display_name text,
  currency text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  tx_count bigint,
  invested_usd numeric,
  holdings jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin_caller() THEN
    RAISE EXCEPTION 'not_admin';
  END IF;
  RETURN QUERY
  SELECT
    u.id,
    u.email,
    u.raw_user_meta_data ->> 'username',
    p.display_name,
    p.currency,
    u.created_at,
    u.last_sign_in_at,
    COALESCE(t.tx_count, 0),
    COALESCE(t.invested_usd, 0),
    COALESCE(t.holdings, '[]'::jsonb)
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  LEFT JOIN (
    SELECT
      tr.user_id,
      COUNT(*) AS tx_count,
      SUM(tr.quantity * tr.price_usd + tr.fee_usd) AS invested_usd,
      jsonb_agg(
        jsonb_build_object(
          'symbol', tr.symbol,
          'coin_name', tr.coin_name,
          'quantity', tr.quantity,
          'invested_usd', tr.invested_usd,
          'invested_vnd', tr.invested_vnd
        ) ORDER BY tr.invested_usd DESC
      ) AS holdings
    FROM (
      SELECT
        user_id, symbol, coin_name,
        SUM(quantity) AS quantity,
        SUM(quantity * price_usd + fee_usd) AS invested_usd,
        CASE WHEN COUNT(*) FILTER (WHERE price_vnd IS NULL) = 0
          THEN SUM(quantity * price_vnd + COALESCE(fee_vnd, 0))
          ELSE NULL END AS invested_vnd
      FROM public.transactions
      GROUP BY user_id, symbol, coin_name
    ) tr
    GROUP BY tr.user_id
  ) t ON t.user_id = u.id
  ORDER BY u.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;

-- Sửa tên hiển thị / tiền tệ của một tài khoản (admin sửa cho người khác).
CREATE OR REPLACE FUNCTION public.admin_update_user(
  p_target uuid,
  p_display_name text,
  p_currency text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin_caller() THEN
    RAISE EXCEPTION 'not_admin';
  END IF;
  IF p_currency NOT IN ('VND', 'USDT', 'KRW') THEN
    RAISE EXCEPTION 'invalid_currency';
  END IF;
  UPDATE public.profiles
  SET display_name = NULLIF(btrim(p_display_name), ''),
      currency = p_currency
  WHERE id = p_target;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_user(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_user(uuid, text, text) TO authenticated;

-- Xóa hẳn một tài khoản: giao dịch, danh mục tham khảo, theo dõi, thông
-- báo, push subscription, hồ sơ rồi cuối cùng là tài khoản đăng nhập.
-- Không cho xóa chính mình và không cho xóa tài khoản admin.
CREATE OR REPLACE FUNCTION public.admin_delete_user(p_target uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_email text;
BEGIN
  IF NOT public.is_admin_caller() THEN
    RAISE EXCEPTION 'not_admin';
  END IF;
  IF p_target = auth.uid() THEN
    RAISE EXCEPTION 'cannot_delete_self';
  END IF;
  SELECT lower(email) INTO target_email FROM auth.users WHERE id = p_target;
  IF target_email IS NULL THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;
  IF target_email = 'yuntuan1309@gmail.com' THEN
    RAISE EXCEPTION 'cannot_delete_admin';
  END IF;

  DELETE FROM public.push_subscriptions WHERE user_id = p_target;
  DELETE FROM public.notifications WHERE user_id = p_target OR investor_id = p_target;
  DELETE FROM public.investor_follows WHERE investor_id = p_target OR follower_id = p_target;
  DELETE FROM public.admin_allocations WHERE user_id = p_target;
  DELETE FROM public.reference_portfolios WHERE user_id = p_target;
  DELETE FROM public.transactions WHERE user_id = p_target;
  DELETE FROM public.profiles WHERE id = p_target;
  DELETE FROM auth.users WHERE id = p_target;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO authenticated;
