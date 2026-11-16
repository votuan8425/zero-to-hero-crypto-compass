/** Maps auth error messages to Vietnamese. */
export function translateAuthError(err: unknown): string {
  const msg = err instanceof Error ? err.message : typeof err === "object" && err && "message" in err ? String((err as { message: unknown }).message) : String(err ?? "");
  const m = msg.toLowerCase();
  if (m.includes("invalid login credentials")) return "Email hoặc mật khẩu không đúng.";
  if (m.includes("email not confirmed")) return "Email chưa được xác nhận. Vui lòng kiểm tra hộp thư.";
  if (m.includes("user already registered") || m.includes("already been registered")) return "Email này đã được đăng ký. Vui lòng đăng nhập.";
  if (m.includes("password should be at least") || m.includes("password is too short")) return "Mật khẩu phải có ít nhất 6 ký tự.";
  if (m.includes("weak") || m.includes("pwned") || m.includes("compromised")) return "Mật khẩu quá yếu hoặc đã bị lộ. Vui lòng chọn mật khẩu khác.";
  if (m.includes("rate limit") || m.includes("too many")) return "Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.";
  if (m.includes("current password")) return "Mật khẩu hiện tại không đúng hoặc chưa được nhập.";
  if (m.includes("same") && m.includes("password")) return "Mật khẩu mới phải khác mật khẩu cũ.";
  if (m.includes("invalid email") || m.includes("unable to validate email")) return "Địa chỉ email không hợp lệ.";
  if (m.includes("expired") || m.includes("invalid") && m.includes("token")) return "Liên kết đã hết hạn hoặc không hợp lệ. Vui lòng yêu cầu liên kết mới.";
  if (m.includes("fetch") || m.includes("network")) return "Không có kết nối mạng. Vui lòng thử lại.";
  if (m.includes("popup") || m.includes("cancel")) return "Đăng nhập đã bị huỷ.";
  return "Đã có lỗi xảy ra. Vui lòng thử lại.";
}
