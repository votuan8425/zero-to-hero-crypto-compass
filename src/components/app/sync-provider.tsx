import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { flushQueue, profileKey, refsKey, txKey } from "@/lib/data";
import { readQueue } from "@/lib/offline-queue";

interface SyncState {
  online: boolean;
  pending: number;
  syncing: boolean;
  realtime: boolean;
  lastSyncedAt: Date | null;
  syncNow: () => Promise<void>;
}

const SyncContext = createContext<SyncState | null>(null);

export function useSync() {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error("useSync must be used inside SyncProvider");
  return ctx;
}

export function SyncProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const qc = useQueryClient();
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [realtime, setRealtime] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  const refreshPending = useCallback(() => setPending(readQueue(userId).length), [userId]);

  const syncNow = useCallback(async () => {
    if (!navigator.onLine) return;
    setSyncing(true);
    try {
      const hadPending = readQueue(userId).length > 0;
      const { applied, conflicts } = await flushQueue(userId);
      await qc.invalidateQueries({ queryKey: txKey(userId) });
      await qc.invalidateQueries({ queryKey: refsKey(userId) });
      await qc.invalidateQueries({ queryKey: profileKey(userId) });
      setLastSyncedAt(new Date());
      if (hadPending && applied > 0) toast.success(`Đã đồng bộ ${applied} thay đổi lên đám mây.`);
      if (conflicts > 0) toast.warning(`${conflicts} thay đổi ngoại tuyến bị bỏ qua vì đã có bản mới hơn từ thiết bị khác.`);
    } finally {
      setSyncing(false);
      refreshPending();
    }
  }, [qc, userId, refreshPending]);

  useEffect(() => {
    setOnline(navigator.onLine);
    refreshPending();
    const goOnline = () => { setOnline(true); void syncNow(); };
    const goOffline = () => setOnline(false);
    const onQueue = () => refreshPending();
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    window.addEventListener("zth:queue-changed", onQueue);
    window.addEventListener("storage", onQueue);
    if (navigator.onLine) void syncNow();
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("zth:queue-changed", onQueue);
      window.removeEventListener("storage", onQueue);
    };
  }, [syncNow, refreshPending]);

  // Real-time sync: other devices' changes refresh this device's data.
  useEffect(() => {
    const channel = supabase
      .channel(`sync-${userId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions", filter: `user_id=eq.${userId}` }, () => {
        void qc.invalidateQueries({ queryKey: txKey(userId) });
        setLastSyncedAt(new Date());
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "reference_portfolios", filter: `user_id=eq.${userId}` }, () => {
        void qc.invalidateQueries({ queryKey: refsKey(userId) });
        setLastSyncedAt(new Date());
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles", filter: `id=eq.${userId}` }, () => {
        void qc.invalidateQueries({ queryKey: profileKey(userId) });
      })
      .subscribe((status) => setRealtime(status === "SUBSCRIBED"));
    return () => { void supabase.removeChannel(channel); };
  }, [qc, userId]);

  return (
    <SyncContext.Provider value={{ online, pending, syncing, realtime, lastSyncedAt, syncNow }}>
      {children}
    </SyncContext.Provider>
  );
}
