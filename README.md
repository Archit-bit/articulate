# Articulate — a personal speaking coach

A small web app that runs on your Mac and trains articulation the way a coach would:
**put you on the spot → tell you exactly what to fix → make you redo it → track the pattern.**

Powered by the Gemini API (free tier works). Everything you save stays in your browser.

---

## Setup (once, ~5 minutes)

1. **Node.js** — check with `node -v` in Terminal. If it's missing or older than v18, install the LTS from https://nodejs.org.
2. **Gemini API key** — go to https://aistudio.google.com/apikey → *Create API key* (free).
3. **Run it** — double-click `start.command` in this folder.
   Or in Terminal:
   ```bash
   cd ~/Desktop/Personal/VIBECODE/articulate
   npm install      # first time only
   npm run dev
   ```
   It opens at http://localhost:5173. Use **Chrome**.
4. In the app: **Settings → paste your key → Test**. Fill in **About you** (what you do, who your clients are) so roleplays and feedback fit your real work.
5. Allow microphone access when Chrome asks.

If double-clicking `start.command` is blocked, right-click it → Open, or use the Terminal commands above.

---

## The daily routine (15 minutes)

The **Today** screen lays this out and ticks items off as you go:

| # | Drill | Time | What it trains |
|---|-------|------|----------------|
| 1 | **Rephrase** | 3 min | Word choice and register — one blunt sentence said *simple*, *diplomatic*, *persuasive* |
| 2 | **Impromptu** | 5 min | Thinking on your feet — find a point + a structure in 15 seconds, speak 60–90 s |
| 3 | **Explain & compress** *or* **Client roleplay** (alternate days) | 7–10 min | Clarity under compression (2:00 → 1:00 → 0:20), or a live conversation with objections |

**The rule that makes it work: always do the retry.** Every scorecard ends with *one* thing to fix. Retry straight away, and the coach tells you what actually changed. That retry loop is where improvement happens — not in reading the feedback.

---

## What you get after each take

- **Overall score + one-line verdict** (scores are calibrated: 5 = average professional, 7 = good)
- **Length, pace (words/min), filler count** — flagged when off
- **Fix this next** — one concrete instruction for the retry
- **Five scores** — clarity, structure, concision, confidence, language
- **What to fix** — quoting your exact words
- **Word swaps** — auto-saved to your **Phrasebank**
- **A stronger version in your own words** — read it aloud once, then retry without looking
- **Your transcript** with fillers highlighted, plus the recording to listen back

**Client roleplay** is a live voice call with a client persona (defence PSU officer, hospital admin, pharma distributor, plant head, unhappy client, interview panel, or your own). Pick *friendly / realistic / tough*. Afterwards you get a debrief: where the meeting ended up, the 2–4 moments that mattered (what the client said, what you said, what would have been stronger), and one thing to fix.
Use **Custom** to rehearse a real meeting the day before.

**Phrasebank** collects every word swap from every session. Use *Practise* mode as flashcards: see what you said, say a sharper version out loud, then reveal.

---

## Costs and privacy

- **Free tier:** both the coach model (`gemini-3.8-flash`) and the live voice model (`gemini-3.8-live`) are free of charge on the free tier, within Google's rate limits. If you hit a limit, wait a minute or switch the coach to a Flash-Lite model in Settings.
- **If you enable billing:** a 10-minute roleplay on `gemini-3.8-live` costs roughly ₹10–20 (about $0.005/min of your audio + $0.018/min of the client's audio). Drills cost a fraction of a rupee each.
- ⚠️ **Free-tier data is used by Google to improve its products, and humans may review it.** Google's terms say not to send confidential information on the free tier. So in roleplays, **don't use real client names, tender details or anything under NDA** — describe the situation generically. If you want privacy for real client rehearsals, turn on billing for the key (paid usage isn't used for training).
- Your key, sessions and phrasebank live in this browser's local storage only. Use **Settings → Export backup** occasionally.
- The hosted build never contains a key — each person pastes their own in Settings, and it stays in their browser.

### Where to see what it costs

- **In the app:** Settings → **Usage & cost**. Shows drills, roleplay minutes and an estimated ₹ cost for this month and all time. It's priced at Google's list rates and updates immediately. Set *Free tier / Billing on* to match your key. It only counts usage from that browser.
- **Google's real numbers:** [aistudio.google.com/usage](https://aistudio.google.com/usage) (requests and tokens) and [aistudio.google.com/billing](https://aistudio.google.com/billing) (money). Can lag up to 24 hours.
- **Put a ceiling on it:** [aistudio.google.com/spend](https://aistudio.google.com/spend) → *Monthly spend cap*.
- On the **free tier**, nothing is charged at all.

---

## Run it on Google Cloud with your $300 credit (recommended, ≈15 minutes once)

The $300 free-trial credit can't pay for AI Studio API keys, but it **can** pay for Gemini on **Vertex AI** (Google Cloud). This setup runs the whole app on **Cloud Run** in Mumbai. You get one link for you and your cofounder, protected by a team passcode, with **no API keys at all**. Everything is paid from your Google Cloud credits.

```
Browser ──> Cloud Run (this app + small server, Mumbai) ──> Vertex AI Gemini (drills, debriefs, live roleplay)
                 └─ team passcode                          └─ billed to your Google Cloud project → $300 credit
```

1. **Pick a project.** In [console.cloud.google.com](https://console.cloud.google.com), use the project the trial created (e.g. *My First Project*) or create one. Note its **Project ID**.
2. **Open Cloud Shell:** the `>_` icon at the top right of the console. It's a terminal in the browser with everything preinstalled, so you don't need to install anything on your Mac.
3. **Upload** `articulate-gcp.zip` (in this folder) using Cloud Shell's **⋮ → Upload** menu.
4. Run:
   ```bash
   unzip -o articulate-gcp.zip -d articulate && cd articulate
   gcloud config set project YOUR_PROJECT_ID
   bash deploy-gcp.sh
   ```
   It asks you to **choose a team passcode**. Then it turns on the needed services, gives the server permission to use Vertex AI, and builds and deploys the app. That takes 3–5 minutes.
5. Open the `https://articulate-….run.app` link it prints. Go to **Settings**: the engine shows *Google Cloud server*. Enter the passcode → **Test**. You should see "Connected to Google Cloud ✓".
6. Share the link and the passcode with your cofounder. He doesn't need a key.

**Updating later:** upload the new `articulate-gcp.zip`, run the same three commands again, and type the same passcode.

**Good to know**
- **Live voice model:** the server tries Gemini 3.8 Live first. New Google Cloud projects often don't have it enabled yet (it's allow-listed), so the server then switches to Gemini 2.5 Native Audio automatically. The drills use Gemini 3.8 Flash, falling back to 3.7 Flash and 3.5 Flash-Lite if Google is busy.
- **Cost tracking:** Settings → Usage & cost shows an estimate. Real numbers are in Cloud Console → Billing → *Reports* and *Credits*. Also add a **budget alert** (Billing → Budgets & alerts), e.g. ₹2,000, so you get an email if spending goes above it.
- **When the trial ends** (90 days, or when the $300 runs out), Google stops the services unless you upgrade. You won't get a surprise bill.
- **Privacy:** on Google Cloud, Vertex AI doesn't use your prompts to train Google's models, which is better than the AI Studio free tier.
- **The AWS Amplify link still works:** in Settings, set Engine → *Google Cloud server*, and paste the Cloud Run link into *Server address*. Simpler: just use the Cloud Run link.
- **Change the passcode:** run `APP_PASSCODE=newcode bash deploy-gcp.sh`.

---

## Share it: host on AWS Amplify (≈10 minutes, once)

The app is a static website, so hosting is trivial and costs next to nothing (AWS credits cover it). You get an `https://…amplifyapp.com` link that works in Chrome on any laptop or phone — the microphone needs HTTPS, which Amplify provides.

1. **Build the upload file.** In Terminal, in this folder: `npm run package` → creates `articulate-site.zip`.
   (A ready-made one is already in this folder.)
2. Open the **AWS Console → AWS Amplify → Create new app**.
3. Choose **Deploy without Git** → **Next**.
4. App name `articulate`, branch name `main`, method **Drag and drop**.
5. Drop `articulate-site.zip` onto the box → **Save and deploy**. Wait about a minute.
6. Open the **Domain** link shown for the branch. That's the link to share.

**Optional — keep it private:** in the Amplify app, go to **Hosting → Access control** and set a username and password for the `main` branch.

**Updating later:** run `npm run package` again, open the Amplify app → the `main` branch → **Deploy updates**, and drop the new zip.

**Who pays for the AI?** AWS credits pay for *hosting* only. The AI calls go to Google and are billed to whichever Gemini key is pasted into Settings. The simplest setup is for each person to use their own free key from [aistudio.google.com/apikey](https://aistudio.google.com/apikey). Each person's history and phrasebank stay in their own browser.

---

## Tips

- **Wear headphones for roleplay.** Without them, the app pauses your mic while the client talks (so it doesn't hear itself) — which means you can't interrupt. With headphones, tick the box and it behaves like a real call.
- Press **Space** to start/stop recording.
- Say the stronger version out loud. Reading it silently does almost nothing.
- Hinglish is fine — the coach only flags it when it would hurt clarity in a formal setting.
- Once a week, open **History** and re-do the lowest-scoring topic.

---

## Customising

- Topics, rephrase sentences, explain presets and roleplay clients live in `src/lib/content.ts` — add your own (e.g. real objections you've heard).
- The coach's rubric and the roleplay persona prompt live in `src/lib/gemini.ts`.
- Model names are in **Settings** (choose *Other model name…* if Google releases newer ones).

## Troubleshooting

| Problem | Fix |
|---|---|
| "Your project has been denied access" | Your key is fine — Google has blocked the project behind it. See below. |
| "API key is not valid" | Re-copy the key from aistudio.google.com/apikey (keys now start with `AQ.` or `AIza`) |
| "Microphone permission was blocked" | Click the mic icon in Chrome's address bar → Allow → reload |
| "Free-tier limit reached" | Wait a minute, or Settings → coach model → Flash-Lite |
| "That model name is not available" | Settings → pick another model, or type the current model ID |
| Client keeps interrupting itself | Use headphones, or keep the headphones box unticked |
| Roleplay ends by itself | Live voice sessions are capped at 15 minutes by Google |
| `npm run dev` fails | Check `node -v` is 18 or newer |

### "Your project has been denied access" (403)

The key authenticates, but Google has put an account-level restriction on the Google Cloud project it belongs to, so every model refuses to generate. Nothing in the app can fix this. In order of effort:

1. **Verify the Google account** that owns the key: add a phone number and turn on 2-Step Verification (myaccount.google.com → Security). Then create a **new key in a new project** in AI Studio and test again.
2. **Look for an appeal banner:** open console.cloud.google.com, select the key's project, and check the top of the page. AI Studio's dashboard may also show the project as *Restricted*.
3. **Use a different Google account** — e.g. a personal Gmail instead of a work/Workspace account — to create the key.
4. **Add billing** to the project (Cloud Billing, or prepaid credits in AI Studio). Restricted free-tier projects often work once billing is attached, and paid usage also keeps your practice data out of Google's training.

Press **Test** in Settings after each step — it tells you whether the key, the model names or the project is the problem.

### Keeping the key in a file instead of the browser (local only)

Copy `.env.example` to `.env.local`, paste the key after `VITE_GEMINI_API_KEY=`, and restart `npm run dev`. A key typed into Settings takes priority. `.env.local` is git-ignored and is **only used by `npm run dev`** — it is never included in the hosted build.

## Project layout

```
src/
  lib/audio.ts        mic capture (16 kHz PCM), WAV encoding, playback
  lib/gemini.ts       coach prompt + JSON schema, roleplay persona, debrief
  lib/content.ts      topics, sentences, scenarios — edit freely
  lib/store.ts        local storage, streaks, stats, usage log
  lib/pricing.ts      Gemini list prices → cost estimate
  lib/engine.ts       which engine is active (Google Cloud server vs Gemini API key)
  lib/live.ts         live roleplay connection for either engine
server/index.mjs      Cloud Run server: serves the app, relays to Vertex AI, checks the passcode
Dockerfile, deploy-gcp.sh   build + one-command deploy from Cloud Shell
  components/         Recorder, Scorecard, AttemptPanel (the speak → feedback → retry loop), Debrief
  screens/            Home, Impromptu, Explain, Rephrase, Roleplay, Phrasebank, History, Settings
```
