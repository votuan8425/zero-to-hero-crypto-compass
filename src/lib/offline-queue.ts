import type { Tx } from "./portfolio";

/** A pending change made while offline, replayed when the connection returns. */
export type PendingOp =
  | {
      kind: "upsert";
      id: string;
      row: Tx & { user_id: string };
      queuedAt: number;
      baseUpdatedAt: string | null;
    }
  | { kind: "delete"; id: string; queuedAt: number; baseUpdatedAt: string | null };

const key = (userId: string) => `zth:queue:${userId}`;

export function readQueue(userId: string): PendingOp[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(key(userId));
    return raw ? (JSON.parse(raw) as PendingOp[]) : [];
  } catch {
    return [];
  }
}

export function writeQueue(userId: string, ops: PendingOp[]) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(key(userId), JSON.stringify(ops));
  window.dispatchEvent(new CustomEvent("zth:queue-changed"));
}

/**
 * Adds an op, collapsing it with any earlier op for the same row so each row
 * is written at most once on reconnect (no duplicate transactions).
 * A delete of a row that was only ever created offline cancels both.
 */
export function coalesce(ops: PendingOp[], next: PendingOp): PendingOp[] {
  const prev = ops.find((o) => o.id === next.id);
  const rest = ops.filter((o) => o.id !== next.id);
  if (!prev) return [...rest, next];
  const createdOffline = prev.kind === "upsert" && prev.baseUpdatedAt === null;
  if (next.kind === "delete" && createdOffline) return rest;
  // Keep the original base version so conflict detection compares against what the user first saw.
  return [...rest, { ...next, baseUpdatedAt: prev.baseUpdatedAt } as PendingOp];
}

export function enqueue(userId: string, op: PendingOp) {
  writeQueue(userId, coalesce(readQueue(userId), op));
}

/** Overlays pending offline changes on top of server rows for display. */
export function applyPending(rows: Tx[], ops: PendingOp[]): Tx[] {
  const map = new Map(rows.map((r) => [r.id, r]));
  for (const op of ops) {
    if (op.kind === "delete") map.delete(op.id);
    else map.set(op.id, op.row);
  }
  return [...map.values()].sort((a, b) =>
    a.tx_date < b.tx_date ? 1 : a.tx_date > b.tx_date ? -1 : 0,
  );
}

export type ConflictDecision = "apply" | "skip-server-newer" | "skip-deleted";

/**
 * Conflict rule for replaying an edit/delete: if the row changed on another
 * device after this device's version and that change is newer than the
 * offline edit, the newer server version wins. Edits to rows deleted
 * elsewhere are dropped. New rows always apply (idempotent by id).
 */
export function decideConflict(
  op: PendingOp,
  server: { updated_at: string } | null,
): ConflictDecision {
  if (op.baseUpdatedAt === null) return "apply";
  if (!server) return op.kind === "delete" ? "apply" : "skip-deleted";
  const serverTime = new Date(server.updated_at).getTime();
  const baseTime = new Date(op.baseUpdatedAt).getTime();
  if (serverTime > baseTime && serverTime > op.queuedAt) return "skip-server-newer";
  return "apply";
}
