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
#variable_conflict use_column
BEGIN
  IF NOT public.is_admin_caller() THEN
    RAISE EXCEPTION 'not_admin';
  END IF;
  RETURN QUERY
  SELECT
    u.id,
    u.email::text,
    u.raw_user_meta_data ->> 'username',
    p.display_name,
    p.currency,
    u.created_at,
    u.last_sign_in_at,
    COALESCE(t.tx_count, 0)::bigint,
    COALESCE(t.invested_usd, 0),
    COALESCE(t.holdings, '[]'::jsonb)
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  LEFT JOIN (
    SELECT
      tr.user_id,
      SUM(tr.n_tx) AS tx_count,
      SUM(tr.invested_usd) AS invested_usd,
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
        COUNT(*) AS n_tx,
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