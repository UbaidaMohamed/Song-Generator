import { normalizeSong } from "./normalize";
import { buildUserPrompt, SONG_SYSTEM_PROMPT } from "./prompt";
import { rawSongSchema, SONG_JSON_SCHEMA, type GenerateInput, type Song } from "./schema";

const RESPONSES_URL = "https://api.x.ai/v1/responses";
const DEFAULT_MODEL = "grok-4.7";
const EFFORTS = new Set(["low", "medium", "high", "xhigh"]);

export class GrokError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "GrokError";
    this.status = status;
  }
}

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

type ModelPayload = {
  output_text?: unknown;
  output?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
  choices?: Array<{ message?: { content?: string | null } }>;
};

export function readModelText(payload: ModelPayload): string {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text;
  }

  const chunks: string[] = [];
  for (const item of payload.output ?? []) {
    if (item.type && item.type !== "message") continue;
    for (const part of item.content ?? []) {
      if ((part.type === "output_text" || part.type === "text" || !part.type) && part.text) {
        chunks.push(part.text);
      }
    }
  }
  if (chunks.length > 0) return chunks.join("");

  const chat = payload.choices?.[0]?.message?.content;
  if (typeof chat === "string" && chat.trim()) return chat;
  throw new GrokError(502, "The model returned an empty song. Try again.");
}

export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    // Models sometimes wrap JSON in prose or a fence. Recover the object.
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    return JSON.parse(fenced[1]) as unknown;
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1)) as unknown;
  }
  throw new SyntaxError("No JSON object in the model response.");
}

function modelName() {
  const configured = process.env.XAI_MODEL?.trim();
  if (configured && /^[A-Za-z0-9._-]{1,64}$/.test(configured)) return configured;
  return DEFAULT_MODEL;
}

function reasoningEffort() {
  const configured = process.env.XAI_REASONING_EFFORT?.trim().toLowerCase();
  if (configured && EFFORTS.has(configured)) return configured;
  return "low";
}

function failureMessage(status: number) {
  if (status === 401 || status === 403) {
    return "The xAI API key was rejected. Check XAI_API_KEY on the server.";
  }
  if (status === 429) return "xAI is rate-limiting this app. Wait a minute and try again.";
  if (status === 400) return "The music model rejected the request. Try a shorter description.";
  return "The music model could not write a song. Try again.";
}

export async function generateSong(
  input: GenerateInput,
  options?: { fetchImpl?: FetchLike; apiKey?: string },
): Promise<Song> {
  const apiKey = options?.apiKey ?? process.env.XAI_API_KEY;
  if (!apiKey) {
    throw new GrokError(500, "Song generation is not configured. Add XAI_API_KEY on the server.");
  }

  const fetchImpl = options?.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(RESPONSES_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelName(),
        store: false,
        temperature: 0.8,
        max_output_tokens: 8000,
        reasoning: { effort: reasoningEffort() },
        input: [
          { role: "system", content: SONG_SYSTEM_PROMPT },
          { role: "user", content: buildUserPrompt(input) },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "song",
            strict: true,
            schema: SONG_JSON_SCHEMA,
          },
        },
      }),
      signal: AbortSignal.timeout(55_000),
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    throw new GrokError(
      504,
      timedOut
        ? "The music model took too long. Try again."
        : "Could not reach the music model. Try again.",
    );
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("xAI song request failed", response.status, detail.slice(0, 400));
    throw new GrokError(response.status === 429 ? 429 : 502, failureMessage(response.status));
  }

  let payload: ModelPayload;
  try {
    payload = (await response.json()) as ModelPayload;
  } catch {
    throw new GrokError(502, "The music model sent an unreadable response. Try again.");
  }

  let parsed: unknown;
  try {
    parsed = extractJson(readModelText(payload));
  } catch {
    throw new GrokError(502, "The model returned a song we couldn't read. Try again.");
  }

  const song = rawSongSchema.safeParse(parsed);
  if (!song.success) {
    console.error("Song schema mismatch", song.error.issues.slice(0, 4));
    throw new GrokError(502, "The model returned a song in an unexpected shape. Try again.");
  }

  try {
    return normalizeSong(song.data, { energy: input.energy, tempo: input.tempo });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The song could not be played.";
    throw new GrokError(502, message);
  }
}
