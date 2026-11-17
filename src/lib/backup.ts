import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { Tx } from "./portfolio";
import type { Profile, ReferencePortfolio } from "./data";
import type { LegacyRecord } from "./legacy-migration";

export interface BackupFile {
  app: "zero-to-hero";
  version: 1;
  exportedAt: string;
  profile: Pick<Profile, "display_name" | "currency" | "settings"> | null;
  transactions: Tx[];
  references: Omit<ReferencePortfolio, "image_paths">[];
}

export function buildBackup(
  profile: Profile | undefined,
  txs: Tx[],
  refs: ReferencePortfolio[],
): BackupFile {
  return {
    app: "zero-to-hero",
    version: 1,
    exportedAt: new Date().toISOString(),
    profile: profile
      ? {
          display_name: profile.display_name,
          currency: profile.currency,
          settings: profile.settings,
        }
      : null,
    transactions: txs,
    references: refs.map(({ image_paths: _omit, ...r }) => r),
  };
}

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function parseBackup(text: string): BackupFile {
  const data = JSON.parse(text) as Partial<BackupFile>;
  if (data.app !== "zero-to-hero" || !Array.isArray(data.transactions))
    throw new Error("Tệp sao lưu không hợp lệ.");
  return { ...data, references: data.references ?? [] } as BackupFile;
}

/**
 * Restores a backup into the signed-in account without duplicating rows:
 * each record gets a stable import key derived from its original id.
 */
export async function restoreBackup(
  userId: string,
  backup: BackupFile,
  existingTxIds: Set<string>,
  existingRefs: ReferencePortfolio[],
) {
  const txRows = backup.transactions
    .filter((t) => !existingTxIds.has(t.id))
    .map((t) => ({
      user_id: userId,
      symbol: t.symbol,
      coin_name: t.coin_name,
      quantity: Number(t.quantity),
      price_usd: Number(t.price_usd),
      fee_usd: Number(t.fee_usd ?? 0),
      tx_date: t.tx_date,
      note: t.note ?? null,
      import_key: `backup:${t.id}`,
    }));
  let txInserted = 0;
  for (let i = 0; i < txRows.length; i += 500) {
    const chunk = txRows.slice(i, i + 500);
    const { data, error } = await supabase
      .from("transactions")
      .upsert(chunk, { onConflict: "user_id,import_key", ignoreDuplicates: true })
      .select("id");
    if (error) throw error;
    txInserted += data?.length ?? 0;
  }
  const refKeys = new Set(existingRefs.map((r) => `${r.name}|${r.created_at}`));
  const refRows = backup.references.filter(
    (r) => !existingRefs.some((e) => e.id === r.id) && !refKeys.has(`${r.name}|${r.created_at}`),
  );
  for (const r of refRows) {
    const { error } = await supabase.from("reference_portfolios").insert({
      user_id: userId,
      name: r.name,
      description: r.description,
      notes: r.notes,
      holdings: r.holdings as unknown as Json,
      total_value: r.total_value,
      total_value_currency: r.total_value_currency,
      ai_summary: r.ai_summary,
      created_at: r.created_at,
    });
    if (error) throw error;
  }
  if (backup.profile) {
    await supabase
      .from("profiles")
      .update({ display_name: backup.profile.display_name, currency: backup.profile.currency })
      .eq("id", userId);
  }
  return {
    txInserted,
    txSkipped: backup.transactions.length - txInserted,
    refsInserted: refRows.length,
  };
}

/** Imports purchases found in this browser's old local storage. Safe to run repeatedly. */
export async function importLegacy(userId: string, records: LegacyRecord[]) {
  const rows = records.map((r) => ({
    user_id: userId,
    symbol: r.symbol,
    coin_name: r.coin_name,
    quantity: r.quantity,
    price_usd: r.price_usd,
    fee_usd: r.fee_usd,
    tx_date: r.tx_date,
    note: r.note,
    import_key: r.importKey,
  }));
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase
      .from("transactions")
      .upsert(rows.slice(i, i + 500), { onConflict: "user_id,import_key", ignoreDuplicates: true });
    if (error) throw error;
  }
  // Verify every record now exists in the cloud.
  const keys = records.map((r) => r.importKey);
  let found = 0;
  for (let i = 0; i < keys.length; i += 200) {
    const { count, error } = await supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .in("import_key", keys.slice(i, i + 200));
    if (error) throw error;
    found += count ?? 0;
  }
  return { expected: records.length, found };
}
