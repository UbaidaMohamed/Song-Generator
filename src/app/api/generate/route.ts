import { generateSong, GrokError, requireApiKey } from "@/lib/grok";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { generateInputSchema } from "@/lib/schema";
import { synthesizeVocals } from "@/lib/tts";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const MAX_BODY_CHARS = 8_000;

function jsonError(status: number, error: string, extraHeaders?: HeadersInit) {
  return Response.json(
    { error },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        ...extraHeaders,
      },
    },
  );
}

export async function POST(request: Request) {
  let raw = "";
  try {
    raw = await request.text();
  } catch {
    return jsonError(400, "Send a JSON body describing the song.");
  }
  if (raw.length > MAX_BODY_CHARS) {
    return jsonError(400, "That request is too large.");
  }

  let body: unknown;
  try {
    body = JSON.parse(raw) as unknown;
  } catch {
    return jsonError(400, "The request was not valid JSON.");
  }

  const parsed = generateInputSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, parsed.error.issues[0]?.message ?? "Check the form and try again.");
  }

  let apiKey: string;
  try {
    apiKey = requireApiKey();
  } catch (error) {
    if (error instanceof GrokError) return jsonError(error.status, error.message);
    throw error;
  }

  const limit = checkRateLimit(clientIp(request));
  if (!limit.ok) {
    const error =
      limit.scope === "global"
        ? "The studio is busy right now. Try again in a little while."
        : "You've made several songs recently. Wait a bit before generating another.";
    return jsonError(429, error, { "Retry-After": String(limit.retryAfterSec) });
  }

  try {
    const song = await generateSong(parsed.data, { apiKey });
    const vocal = await synthesizeVocals(song, parsed.data, { apiKey });
    if (!vocal.ok) {
      if (vocal.fatal) return jsonError(vocal.status, vocal.message);
      return Response.json(
        { song, vocal: null, vocalError: vocal.message },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    return Response.json({ song, vocal: vocal.vocal }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof GrokError) return jsonError(error.status, error.message);
    console.error("Unexpected song generation failure", error);
    return jsonError(500, "Something went wrong while writing the song.");
  }
}
