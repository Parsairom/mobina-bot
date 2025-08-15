import type { Env } from "./env";

// Gemini has a genuinely free tier (unlike Anthropic, which only gives a
// small one-time trial credit), so the AI-powered features use it by default.
//
// New Gemini API keys are cut over to the newer Interactions API
// (generateContent/gemini-2.5-flash returns 404 "no longer available to new
// users" for them) - see https://ai.google.dev/gemini-api/docs/migrate-to-interactions.
const MODEL = "gemini-3.6-flash";
const INTERACTIONS_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";

interface InteractionResponse {
  output_text?: string;
  steps?: { type?: string; content?: { type?: string; text?: string }[] }[];
}

type InteractionInput = string | Array<{ type: "text"; text: string } | { type: "image"; data: string; mime_type: string }>;

export function isAiConfigured(env: Env): boolean {
  return !!env.GEMINI_API_KEY;
}

async function callGemini(env: Env, input: InteractionInput, system: string): Promise<string> {
  const headers = {
    "x-goog-api-key": env.GEMINI_API_KEY ?? "",
    "content-type": "application/json",
  };
  const body = JSON.stringify({
    model: MODEL,
    input,
    system_instruction: system,
    generation_config: { max_output_tokens: 700 },
  });

  let lastError = "";
  // Gemini occasionally returns a transient 500 INTERNAL error; one retry
  // clears the vast majority of those without the user noticing.
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(INTERACTIONS_URL, { method: "POST", headers, body });
    if (res.ok) {
      const data = (await res.json()) as InteractionResponse;
      if (data.output_text) return data.output_text.trim();

      const modelStep = data.steps?.find((s) => s.type === "model_output");
      const text = modelStep?.content?.map((c) => c.text ?? "").join("") ?? "";
      return text.trim();
    }
    lastError = await res.text();
    if (res.status !== 500) break;
  }

  throw new Error(`Gemini API error: ${lastError}`);
}

export async function askAi(env: Env, system: string, userPrompt: string): Promise<string> {
  return callGemini(env, userPrompt, system);
}

export async function askAiVision(
  env: Env,
  system: string,
  textPrompt: string,
  imageBase64: string,
  mimeType: string
): Promise<string> {
  return callGemini(
    env,
    [
      { type: "text", text: textPrompt },
      { type: "image", data: imageBase64, mime_type: mimeType },
    ],
    system
  );
}
