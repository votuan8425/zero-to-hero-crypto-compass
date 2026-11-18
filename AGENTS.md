<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules
- Purchases sync through `src/lib/data.ts`: writes go to the cloud immediately or into the per-user offline queue (`src/lib/offline-queue.ts`), replayed idempotently by row id — keeps cross-device data duplicate-free.
- Imports (old browser data, backups) use `transactions.import_key` with upsert-ignore-duplicates — makes re-imports safe.
- Market prices come from the public `getPrices` server function (OKX, CoinGecko fallback) and are cached in localStorage for offline use; precious metals (coins with `unit`) are priced only server-side from domestic VND sources parsed in `src/lib/metals.ts`, never from world ounce prices — browsers cannot reach those sources and units differ.
- Screenshot analysis runs server-side in `src/lib/analyze.functions.ts`, reading only the caller's own files from the private `reference-images` bucket.
