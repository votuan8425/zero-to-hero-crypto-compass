-- Tiền tệ hiển thị: USD đổi thành USDT, thêm KRW (Won Hàn Quốc).
-- Chạy qua Supabase SQL editor (như migration 0002/0003).
-- Cho tới khi áp dụng, profiles.currency vẫn chỉ nhận VND/USDT theo
-- CHECK cũ — app tự hiểu tài khoản cũ lưu "USD" là USDT, và nếu lưu
-- USDT/KRW chưa được thì hiện thông báo lỗi để thử lại sau.
UPDATE public.profiles SET currency = 'USDT' WHERE currency = 'USD';

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_currency_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_currency_check CHECK (currency IN ('VND', 'USDT', 'KRW'));
