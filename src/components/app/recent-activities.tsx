import { useQuery } from "@tanstack/react-query";
import { Activity } from "lucide-react";
import { activityDetail, activityLabel, fetchRecentActivities } from "@/lib/activity";

/** "21:05 19/11" — giờ + ngày, không năm, cho vừa một hàng của bảng. */
function formatShortTime(iso: string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(iso));
}

/**
 * Bảng "Hoạt động gần đây" — 3 hành động mới nhất của investor, mỗi hành
 * động một hàng: Thời gian | Hành động | Chi tiết. Chỉ hiện khi đã có dữ
 * liệu (chưa có hành động nào, hoặc bảng chưa được Lovable tạo, thì ẩn).
 */
export function RecentActivities({ userId }: { userId: string }) {
  const { data } = useQuery({
    queryKey: ["admin-activities", userId],
    queryFn: () => fetchRecentActivities(userId, 3),
    staleTime: 60_000,
  });
  const items = data ?? [];
  if (items.length === 0) return null;
  return (
    <div className="mt-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider">
        <Activity className="h-4 w-4 text-primary" /> Hoạt động gần đây
      </h3>
      <div className="mt-2 overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-raised/60 text-left text-xs text-muted-foreground">
              <th scope="col" className="whitespace-nowrap px-3 py-2 font-medium">
                Thời gian
              </th>
              <th scope="col" className="whitespace-nowrap px-3 py-2 font-medium">
                Hành động
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Chi tiết
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((a) => (
              <tr key={a.id}>
                <td className="num whitespace-nowrap px-3 py-2.5 text-muted-foreground">
                  {formatShortTime(a.created_at)}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 font-medium">{activityLabel(a)}</td>
                <td className="px-3 py-2.5">{activityDetail(a)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
