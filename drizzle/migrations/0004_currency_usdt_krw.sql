-- Tiền tệ hiển thị: USD đổi thành USDT, thêm KRW (Won Hàn Quốc).
-- Chạy qua Supabase SQL editor (như migration 0002/0003).
-- Cho tới khi áp dụng, profiles.currency vẫn chỉ nhận VND/USD theo
-- CHECK cũ — app tự hiểu tài khoản cũ lưu "USD" là USDT, và nếu lưu
-- USDT/KRW chưa được thì hiện thông báo lỗi để thử lại sau.
-- THỨ TỰ QUAN TRỌNG: phải DROP CHECK cũ TRƯỚC khi UPDATE, vì CHECK cũ
-- chỉ cho VND/USD — UPDATE USD→USDT mà chạy trước sẽ bị CHECK cũ chặn.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_currency_check;
UPDATE public.profiles SET currency = 'USDT' WHERE currency = 'USD';

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_currency_check CHECK (currency IN ('VND', 'USDT', 'KRW'));
