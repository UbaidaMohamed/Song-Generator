# Song Generator

A public web app that writes a short original song from a mood, an optional style, a tempo or energy level, a voice, and a sentence about what it should be about. Visitors hear a vocal over a band, follow the lyric line that is being sung, and download a WAV of both.

xAI does not offer a music-generation API. As of the [xAI docs](https://docs.x.ai/developers/model-capabilities/audio/text-to-speech) (checked October 2026), speech is text-to-speech on `POST https://api.x.ai/v1/tts`. This app asks Grok for the song, asks that same speech API to perform the lyrics, and synthesizes the band in the browser with [Tone.js](https://tonejs.github.io/).

## How a song is made

1. The browser sends the mood, style, energy, optional tempo, voice, and description to `POST /api/generate`.
2. The route checks length limits and a per-IP rate limit, then checks `XAI_API_KEY`.
3. Grok (`https://api.x.ai/v1/responses`, model `grok-4.7`, low reasoning effort) returns JSON: title, lyrics with sections, key, tempo, chord loop, melody, drum pattern, and instrument choices.
4. The server validates that JSON and repairs small musical mistakes so the page can still play it. A response with no title or no lyrics is rejected.
5. The same key calls `POST https://api.x.ai/v1/tts`. The lyric is wrapped in speech tags that match the mood (`<soft><singing>` for something sad, `<fast><singing>` for something excited or rap-like), at a speed between 0.7 and 1.5. The response is WAV plus character timestamps. "Match the mood" picks a documented voice (Carina for sad, Helix for excited, Eve for happy, and so on). A visitor can pick any built-in voice instead.
6. The browser starts the vocal and the Tone.js band together, ducks the lead, and runs the voice through a short delay. The current lyric line is highlighted from the timestamps. Download mixes the vocal into the WAV on the device. Nothing is uploaded with the audio.

If the vocal request fails after the song is written, the page still plays the instrumental and says so. A missing or rejected key fails the whole request.

`XAI_API_KEY` is read only on the server. It is not prefixed with `NEXT_PUBLIC_`, not sent to the browser, and not written into the repo. There is no second provider key.

## Local setup

Requirements: Node.js 20 or newer.

```bash
npm install
cp .env.example .env.local
```

Edit `.env.local` and set your key from the [xAI console](https://console.x.ai). xAI API keys start with `xai-`.

```bash
XAI_API_KEY=xai-your-key-here
```

Optional:

| Variable | Default | Purpose |
| --- | --- | --- |
| `XAI_MODEL` | `grok-4.7` | Model id for the song JSON. Keep it to letters, numbers, `.`, `_`, and `-`. |
| `XAI_REASONING_EFFORT` | `low` | `low`, `medium`, `high`, or `xhigh`. Low is faster and uses fewer credits. |

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). "Play a sample" previews the band without calling the API. It has no vocal.

```bash
npm test
npm run lint
npm run build
```

`npm test` mocks both the Grok responses call and the TTS call. It does not spend credits.

## Abuse protection

Public visitors share your xAI credits. Each generation spends a Grok request plus one text-to-speech request (billed per character on the same key).

- Mood, style, and description are length-capped (40, 40, and 400 characters). Request bodies over 8 KB are rejected. The voice must be `auto` or one of the built-in ids.
- Each IP address can generate **5 songs per 30 minutes**.
- The whole server process allows **60 generations per hour**.
- The vocal is part of that same request, so it does not count twice.
- Counters live in memory. On Vercel each instance has its own counters, so this slows casual abuse and does not replace a billing cap. Set a budget in the xAI console as well.

Change the numbers in `src/lib/rate-limit.ts` if you want a different allowance.

## Troubleshooting

- **Song generation is not configured.** The server has no `XAI_API_KEY`. Add it to `.env.local` (or the host's environment) and restart. The name must be exactly `XAI_API_KEY`, with no `NEXT_PUBLIC_` prefix.
- **XAI_API_KEY doesn't look like an xAI key.** Keys from [console.x.ai](https://console.x.ai) start with `xai-`. A key from another provider (for example one that starts with `sk-`) will not work here.
- **The xAI API key was rejected.** The key is missing, revoked, or not a secret API key. Create a new key in the xAI console and confirm it starts with `xai-`. The same key is used for Grok and for text-to-speech.
- **The vocal didn't come through.** The arrangement still plays. Generate again, or pick a different voice. Speech tags and the voice list follow the current [text-to-speech docs](https://docs.x.ai/developers/model-capabilities/audio/text-to-speech).

## Deploy on Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FUbaidaMohamed%2FSong-Generator&env=XAI_API_KEY&envDescription=Server-side%20xAI%20API%20key%20from%20console.x.ai.%20It%20must%20start%20with%20xai-.%20Never%20expose%20it%20to%20the%20browser.&envLink=https%3A%2F%2Fconsole.x.ai&project-name=song-generator)

Or do it by hand:

1. Push this repository to GitHub (it is already at [UbaidaMohamed/Song-Generator](https://github.com/UbaidaMohamed/Song-Generator)).
2. In Vercel, choose **Add New… → Project** and import that GitHub repository.
3. Vercel detects Next.js. Leave the install command as `npm install` and the build command as `npm run build`.
4. Open **Environment Variables** and add `XAI_API_KEY`. The value must start with `xai-`. Apply it to Production (and Preview, if you want preview deployments to generate songs). Do not add a `NEXT_PUBLIC_` copy. No other secret is required.
5. Deploy. The generate route asks for up to 60 seconds (`maxDuration`) because it calls Grok and then text-to-speech. Hobby plans often cut functions off at 60 seconds; if a song times out, keep `XAI_REASONING_EFFORT=low`. The page still returns an instrumental if only the vocal step runs out of time.

After it is live, generate one song and confirm the vocal, the highlighted lyric, and a WAV that contains both. The key stays in Vercel's environment storage; it is not part of the client bundle.
