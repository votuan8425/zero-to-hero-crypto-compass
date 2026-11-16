import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { isNetworkError } from "@/lib/data";
import { AppShell } from "@/components/app/app-shell";
import { SyncProvider } from "@/components/app/sync-provider";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (data.user) return { user: data.user };
    // Offline: trust the locally stored session so the app keeps working without a connection.
    if (error && isNetworkError(error)) {
      const { data: s } = await supabase.auth.getSession();
      if (s.session) return { user: s.session.user };
    }
    throw redirect({ to: "/auth", search: { redirect: location.href } });
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user } = Route.useRouteContext();
  return (
    <SyncProvider userId={user.id}>
      <AppShell>
        <Outlet />
      </AppShell>
    </SyncProvider>
  );
}
