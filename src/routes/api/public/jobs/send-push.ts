import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/**
 * Job gửi Web Push cho các thông báo chưa gửi (bảng `notifications`).
 * Lovable cron gọi mỗi 1 phút. Cần Secrets VAPID_PUBLIC_KEY /
 * VAPID_PRIVATE_KEY / VAPID_SUBJECT, nếu chưa có thì job trả về
 * processed = 0 và không lỗi — thông báo trong app vẫn hoạt động.
 */
export const Route = createFileRoute("/api/public/jobs/send-push")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        const { deliverPendingPushNotifications } = await import("@/lib/push.server");
        const result = await deliverPendingPushNotifications();
        return Response.json({ success: true, ...result });
      },
    },
  },
});
