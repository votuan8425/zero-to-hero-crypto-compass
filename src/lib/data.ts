import { queryOptions, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json, Tables } from "@/integrations/supabase/types";
import {
  applyPending,
  decideConflict,
  enqueue,
  readQueue,
  writeQueue,
  type PendingOp,
} from "./offline-queue";
import type { Tx } from "./portfolio";
import type { RefHolding } from "./reference";
import type { Currency } from "./format";

export const REFERENCE_BUCKET = "reference-images";

export interface Profile {
  id: string;
  display_name: string | null;
  currency: Currency;
  settings: Record<string, unknown>;
  local_migrated_at: string | null;
}

export interface ReferencePortfolio {
  id: string;
  name: string;
  description: string | null;
  notes: string | null;
  image_paths: string[];
  holdings: RefHolding[];
  total_value: number | null;
  total_value_currency: string | null;
  ai_summary: string | null;
  created_at: string;
  updated_at: string;
}

const snapshotKey = (kind: string, userId: string) => `zth:cache:${kind}:${userId}`;

function saveSnapshot(kind: string, userId: string, data: unknown) {
  try {
    localStorage.setItem(snapshotKey(kind, userId), JSON.stringify(data));
  } catch {
    /* quota */
  }
}
function readSnapshot<T>(kind: string, userId: string): T | null {
  try {
    const raw = localStorage.getItem(snapshotKey(kind, userId));
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function isNetworkError(e: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  const msg =
    e instanceof Error
      ? e.message
      : typeof e === "object" && e && "message" in e
        ? String((e as { message: unknown }).message)
        : String(e);
  return /failed to fetch|networkerror|network request failed|load failed|fetch failed/i.test(msg);
}

function normalizeTx(r: Tables<"transactions">): Tx {
  return {
    id: r.id,
    symbol: r.symbol,
    coin_name: r.coin_name,
    quantity: Number(r.quantity),
    price_usd: Number(r.price_usd),
    fee_usd: Number(r.fee_usd ?? 0),
    tx_date: r.tx_date,
    note: r.note ?? null,
    updated_at: r.updated_at,
    created_at: r.created_at,
  };
}

/* ---------------- Transactions ---------------- */

export const txKey = (userId: string) => ["transactions", userId] as const;

export const transactionsQuery = (userId: string) =>
  queryOptions({
    queryKey: txKey(userId),
    queryFn: async (): Promise<Tx[]> => {
      let rows: Tx[];
      try {
        const { data, error } = await supabase
          .from("transactions")
          .select("*")
          .order("tx_date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(5000);
        if (error) throw error;
        rows = (data ?? []).map(normalizeTx);
        saveSnapshot("tx", userId, rows);
      } catch (e) {
        const snap = readSnapshot<Tx[]>("tx", userId);
        if (!snap || !isNetworkError(e)) throw e;
        rows = snap;
      }
      return applyPending(rows, readQueue(userId));
    },
  });

export type TxInput = Omit<Tx, "id" | "updated_at" | "created_at">;

/** Saves a purchase. Writes to the cloud immediately, or queues it when offline. Returns "synced" | "queued". */
export async function saveTransaction(
  qc: QueryClient,
  userId: string,
  input: TxInput,
  existing?: Tx,
): Promise<"synced" | "queued"> {
  const id = existing?.id ?? crypto.randomUUID();
  const row = { ...input, id, user_id: userId };
  qc.setQueryData<Tx[]>(txKey(userId), (old = []) =>
    applyPending(old, [{ kind: "upsert", id, row, queuedAt: Date.now(), baseUpdatedAt: null }]),
  );
  const queue = () => {
    enqueue(userId, {
      kind: "upsert",
      id,
      row,
      queuedAt: Date.now(),
      baseUpdatedAt: existing ? (existing.updated_at ?? null) : null,
    });
    return "queued" as const;
  };
  if (typeof navigator !== "undefined" && !navigator.onLine) return queue();
  const { error } = await supabase.from("transactions").upsert(row, { onConflict: "id" });
  if (error) {
    if (isNetworkError(error)) return queue();
    await qc.invalidateQueries({ queryKey: txKey(userId) });
    throw error;
  }
  await qc.invalidateQueries({ queryKey: txKey(userId) });
  return "synced";
}

export async function deleteTransaction(
  qc: QueryClient,
  userId: string,
  tx: Tx,
): Promise<"synced" | "queued"> {
  qc.setQueryData<Tx[]>(txKey(userId), (old = []) => old.filter((t) => t.id !== tx.id));
  const queue = () => {
    enqueue(userId, {
      kind: "delete",
      id: tx.id,
      queuedAt: Date.now(),
      baseUpdatedAt: tx.updated_at ?? null,
    });
    return "queued" as const;
  };
  if (typeof navigator !== "undefined" && !navigator.onLine) return queue();
  const { error } = await supabase.from("transactions").delete().eq("id", tx.id);
  if (error) {
    if (isNetworkError(error)) return queue();
    await qc.invalidateQueries({ queryKey: txKey(userId) });
    throw error;
  }
  await qc.invalidateQueries({ queryKey: txKey(userId) });
  return "synced";
}

let flushing: Promise<{ applied: number; conflicts: number }> | null = null;

/** Replays queued offline changes in order. Idempotent: upserts by id, so a row is never duplicated. */
export function flushQueue(userId: string): Promise<{ applied: number; conflicts: number }> {
  if (flushing) return flushing;
  flushing = (async () => {
    let applied = 0;
    let conflicts = 0;
    const ops = readQueue(userId);
    for (const op of ops) {
      try {
        let server: { updated_at: string } | null = null;
        if (op.baseUpdatedAt !== null) {
          const { data, error } = await supabase
            .from("transactions")
            .select("updated_at")
            .eq("id", op.id)
            .maybeSingle();
          if (error) throw error;
          server = data;
        }
        const decision = decideConflict(op, server);
        if (decision === "apply") {
          const { error } =
            op.kind === "upsert"
              ? await supabase.from("transactions").upsert(op.row, { onConflict: "id" })
              : await supabase.from("transactions").delete().eq("id", op.id);
          if (error) throw error;
          applied++;
        } else {
          conflicts++;
        }
        writeQueue(
          userId,
          readQueue(userId).filter(
            (o: PendingOp) => !(o.id === op.id && o.queuedAt === op.queuedAt),
          ),
        );
      } catch (e) {
        if (isNetworkError(e)) break;
        console.error("Dropping invalid queued change", e);
        writeQueue(
          userId,
          readQueue(userId).filter((o) => !(o.id === op.id && o.queuedAt === op.queuedAt)),
        );
      }
    }
    return { applied, conflicts };
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}

/* ---------------- Profile ---------------- */

export const profileKey = (userId: string) => ["profile", userId] as const;

export const profileQuery = (userId: string) =>
  queryOptions({
    queryKey: profileKey(userId),
    queryFn: async (): Promise<Profile> => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .maybeSingle();
        if (error) throw error;
        let p = data;
        if (!p) {
          const ins = await supabase.from("profiles").insert({ id: userId }).select("*").single();
          if (ins.error) throw ins.error;
          p = ins.data;
        }
        const profile: Profile = {
          id: p.id,
          display_name: p.display_name,
          currency: (p.currency as Currency) ?? "VND",
          settings: (p.settings as Record<string, unknown>) ?? {},
          local_migrated_at: p.local_migrated_at,
        };
        saveSnapshot("profile", userId, profile);
        return profile;
      } catch (e) {
        const snap = readSnapshot<Profile>("profile", userId);
        if (snap && isNetworkError(e)) return snap;
        throw e;
      }
    },
  });

export async function updateProfile(
  userId: string,
  patch: Partial<Pick<Profile, "display_name" | "currency" | "local_migrated_at">> & {
    settings?: Json;
  },
) {
  const { error } = await supabase.from("profiles").update(patch).eq("id", userId);
  if (error) throw error;
}

/* ---------------- Reference portfolios ---------------- */

export const refsKey = (userId: string) => ["references", userId] as const;

function normalizeRef(r: Tables<"reference_portfolios">): ReferencePortfolio {
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? null,
    notes: r.notes ?? null,
    image_paths: r.image_paths ?? [],
    holdings: (r.holdings as unknown as RefHolding[]) ?? [],
    total_value: r.total_value != null ? Number(r.total_value) : null,
    total_value_currency: r.total_value_currency ?? null,
    ai_summary: r.ai_summary ?? null,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

export const referencesQuery = (userId: string) =>
  queryOptions({
    queryKey: refsKey(userId),
    queryFn: async (): Promise<ReferencePortfolio[]> => {
      try {
        const { data, error } = await supabase
          .from("reference_portfolios")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) throw error;
        const rows = (data ?? []).map(normalizeRef);
        saveSnapshot("refs", userId, rows);
        return rows;
      } catch (e) {
        const snap = readSnapshot<ReferencePortfolio[]>("refs", userId);
        if (snap && isNetworkError(e)) return snap;
        throw e;
      }
    },
  });

export type ReferenceInput = Omit<ReferencePortfolio, "id" | "created_at" | "updated_at">;

export async function createReference(userId: string, input: ReferenceInput): Promise<string> {
  const { data, error } = await supabase
    .from("reference_portfolios")
    .insert({ ...input, user_id: userId, holdings: input.holdings as unknown as Json })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function updateReference(id: string, patch: Partial<ReferenceInput>) {
  const { holdings, ...rest } = patch;
  const { error } = await supabase
    .from("reference_portfolios")
    .update({ ...rest, ...(holdings ? { holdings: holdings as unknown as Json } : {}) })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteReference(ref: ReferencePortfolio) {
  const { error } = await supabase.from("reference_portfolios").delete().eq("id", ref.id);
  if (error) throw error;
  if (ref.image_paths.length) await supabase.storage.from(REFERENCE_BUCKET).remove(ref.image_paths);
}

export const signedUrlsQuery = (paths: string[]) =>
  queryOptions({
    queryKey: ["signed-urls", ...paths],
    staleTime: 50 * 60 * 1000,
    enabled: paths.length > 0,
    queryFn: async (): Promise<Record<string, string>> => {
      const { data, error } = await supabase.storage
        .from(REFERENCE_BUCKET)
        .createSignedUrls(paths, 3600);
      if (error) throw error;
      const out: Record<string, string> = {};
      for (const d of data ?? []) if (d.path && d.signedUrl) out[d.path] = d.signedUrl;
      return out;
    },
  });

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export async function uploadReferenceImage(userId: string, file: File): Promise<string> {
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(REFERENCE_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return path;
}

export async function removeReferenceImages(paths: string[]) {
  if (paths.length) await supabase.storage.from(REFERENCE_BUCKET).remove(paths);
}
