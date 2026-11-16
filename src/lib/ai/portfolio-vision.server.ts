import { createOpenAI } from "@ai-sdk/openai";
import { NoObjectGeneratedError, Output, streamText } from "ai";
import { z } from "zod/v4";

import { createLovableAiGatewayRunIdFetch } from "./run-id.server";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1";
const MODEL = "openai/gpt-6-astra";

export const extractionSchema = z.object({
  is_portfolio: z.boolean(),
  holdings: z.array(
    z.object({
      symbol: z.string(),
      name: z.string().nullable(),
      percent: z.number().nullable(),
      percent_source: z.enum(["extracted", "computed", "unknown"]),
      quantity: z.number().nullable(),
      value: z.number().nullable(),
      value_currency: z.string().nullable(),
      confidence: z.enum(["high", "medium", "low"]),
    }),
  ),
  total_value: z.number().nullable(),
  total_value_currency: z.string().nullable(),
  total_value_source: z.enum(["extracted", "computed", "unknown"]),
  unreadable_notes: z.string(),
  summary: z.string(),
});

export type Extraction = z.infer<typeof extractionSchema>;

const INSTRUCTIONS = `You read screenshots of cryptocurrency portfolios (exchange apps, wallets, trackers, spreadsheets, social posts) and return a structured allocation.

Rules — accuracy over completeness:
- Only report numbers that are visibly present. NEVER invent, guess, or round-trip-estimate a number that is not shown.
- symbol: the official ticker in uppercase (BTC, ETH, SOL...). Use "OTHER" for an "Others/Khác/Còn lại" bucket.
- percent: the allocation percentage exactly as printed -> percent_source "extracted".
  If the percent is not printed but BOTH this row's value and the portfolio total (or all row values) are printed, you may compute it -> percent_source "computed".
  Otherwise percent = null and percent_source "unknown".
- quantity: token amount if printed, else null. value: fiat value of the row if printed, else null, with value_currency (e.g. "USD", "VND", "USDT").
- total_value: only if printed (source "extracted") or exactly the sum of all printed row values ("computed"); otherwise null / "unknown".
- confidence: "low" if the text is blurry, cropped, or ambiguous.
- If several images are given, they show the same portfolio; merge rows without double counting.
- If the image is not a crypto portfolio, set is_portfolio false and return no holdings.
- unreadable_notes: in Vietnamese, list anything you could not read or identify (empty string if none).
- summary: one or two Vietnamese sentences describing the portfolio, stating only facts visible in the image.`;

export async function extractPortfolio(images: { dataUrl: string }[], apiKey: string, signal?: AbortSignal): Promise<Extraction> {
  const runIdFetch = createLovableAiGatewayRunIdFetch();
  const provider = createOpenAI({
    baseURL: GATEWAY_URL,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });
  const result = streamText({
    model: provider.responses(MODEL),
    instructions: INSTRUCTIONS,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "Extract the portfolio allocation from these screenshot(s)." },
          ...images.map((img) => ({ type: "image" as const, image: new URL(img.dataUrl) })),
        ],
      },
    ],
    output: Output.object({ schema: extractionSchema }),
    abortSignal: signal,
    providerOptions: {
      openai: {
        forceReasoning: true,
        reasoningEffort: "medium",
        reasoningSummary: "auto",
        store: false,
        include: ["reasoning.encrypted_content"],
      },
    },
  });
  try {
    return (await result.output) as Extraction;
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error) && error.text) {
      const parsed = extractionSchema.safeParse(JSON.parse(error.text));
      if (parsed.success) return parsed.data;
    }
    throw error;
  }
}
