# Song Generator

A public web app that writes a short original song from a mood, an optional style, a tempo or energy level, and a sentence about what it should be about. Visitors can play the result in the browser and download a WAV.

Grok does not currently offer a music-generation API. As of the [xAI docs](https://docs.x.ai) (checked October 2026), audio support is speech (text-to-speech, speech-to-text, realtime voice) and the soundtrack on Imagine video. This app calls Grok server-side for a structured arrangement, validates it, and synthesizes the loop in the browser with [Tone.js](https://tonejs.github.io/).

## How a song is made

1. The browser sends the mood, style, energy, optional tempo, and description to `POST /api/generate`.
2. The route checks length limits and a simple per-IP rate limit, then calls the xAI Responses API (`https://api.x.ai/v1/responses`) with model `grok-4.7` at low reasoning effort.
3. Grok must return JSON: title, lyrics with sections, key, tempo, chord loop, melody, drum pattern, and instrument choices.
4. The server validates that JSON and repairs small musical mistakes (unknown pitches, a short drum pattern, a melody that does not match the chords) so the page can still play it. A response with no title or no lyrics is rejected.
5. Tone.js plays chords, bass, melody, and drums. Download renders the same arrangement to a WAV on the device. The audio file is never uploaded.

`XAI_API_KEY` is read only on the server. It is not prefixed with `NEXT_PUBLIC_`, not sent to the browser, and not written into the repo.

## Local setup

Requirements: Node.js 20 or newer.

```bash
npm install
cp .env.example .env.local
```

Edit `.env.local` and set your key from the [xAI console](https://console.x.ai):

```bash
XAI_API_KEY=your_key_here
```

Optional:

| Variable | Default | Purpose |
| --- | --- | --- |
| `XAI_MODEL` | `grok-4.7` | Model id. Keep it to letters, numbers, `.`, `_`, and `-`. |
| `XAI_REASONING_EFFORT` | `low` | `low`, `medium`, `high`, or `xhigh`. Low is faster and uses fewer credits. |

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). "Play a sample" previews the synthesizer without calling the API.

```bash
npm test
npm run lint
npm run build
```

`npm test` exercises the API route with a mocked Grok response, plus validation, rate limiting, and arrangement checks. It does not spend credits.

## Abuse protection

Public visitors share your xAI credits.

- Mood, style, and description are length-capped (40, 40, and 400 characters). Request bodies over 8 KB are rejected.
- Each IP address can generate **5 songs per 30 minutes**.
- The whole server process allows **60 generations per hour**.
- Counters live in memory. On Vercel each instance has its own counters, so this slows casual abuse and does not replace a billing cap. Set a budget or spend limit in the xAI console as well.

Change the numbers in `src/lib/rate-limit.ts` if you want a different allowance.

## Deploy on Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FUbaidaMohamed%2FSong-Generator&env=XAI_API_KEY&envDescription=Server-side%20xAI%20API%20key%20from%20console.x.ai.%20Never%20expose%20it%20to%20the%20browser.&envLink=https%3A%2F%2Fconsole.x.ai&project-name=song-generator)

Or do it by hand:

1. Push this repository to GitHub (it is already at [UbaidaMohamed/Song-Generator](https://github.com/UbaidaMohamed/Song-Generator)).
2. In Vercel, choose **Add New… → Project** and import that GitHub repository.
3. Vercel detects Next.js. Leave the install command as `npm install` and the build command as `npm run build`.
4. Open **Environment Variables** and add `XAI_API_KEY` with your key. Apply it to Production (and Preview, if you want preview deployments to generate songs). Do not add a `NEXT_PUBLIC_` copy.
5. Deploy. The generate route asks for up to 60 seconds (`maxDuration`). If your plan cuts the function off sooner and songs time out, raise the function duration in the Vercel project settings or keep `XAI_REASONING_EFFORT=low`.

After it is live, generate one song and confirm playback and the WAV download. The key stays in Vercel's environment storage; it is not part of the client bundle.
