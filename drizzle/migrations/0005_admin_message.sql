-- Lời nhắn của nhà đầu tư (tab Tham khảo): admin viết một lời nhắn ngắn
-- hiển thị cùng danh mục đã đăng — chỉ text, không số tiền/số lượng.
-- Chạy qua Supabase SQL editor (như migration 0002/0003/0004).
-- Cho tới khi áp dụng, app vẫn chạy: lời nhắn hiện "—" và khi admin lưu
-- lời nhắn sẽ báo cần chạy migration này trước.

ALTER TABLE public.admin_allocations ADD COLUMN IF NOT EXISTS message text;
ALTER TABLE public.admin_allocations ADD COLUMN IF NOT EXISTS message_updated_at timestamptz;
