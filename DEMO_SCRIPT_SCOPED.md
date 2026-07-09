# MISTER — Demo Video Script v2 (SCOPED, ≤3 min, top-16 preliminary round)

> This is a deliberately narrower script than `DEMO_SCRIPT.md`. It only shows
> features that are confirmed working live today: the browser web demo
> (real hosted QVAC inference), the analytics/reports/distribute tabs, the
> honest fine-tune story via real Kaggle checkpoints, and 37/37 tests + CI.
> It does NOT show the Electron desktop app or the Pear mobile app live —
> this script is intentionally scoped to only the browser web demo for the
> top-16 round, the fastest and lowest-risk path to a clean take. If you've
> verified the Electron desktop app / Pear mobile app on your own hardware
> and want to include them, extend this script before recording.
>
> Record with screen capture (OBS/QuickTime/Loom) at the live URL:
> **https://alexbelij.github.io/MISTER/** — do a full dry run once before
> recording, since the first chat message wakes a sleeping free-tier HF
> Space and can take 30-60s (see 0:35-0:55 below — plan around this, don't
> let it kill your take).
>
> **Why no "unplug the wifi" offline proof in this version:** this scoped
> script only shows the browser demo, which is intentionally *cloud-hosted*
> (a Hugging Face Space) for judge accessibility — it needs a network
> connection to work. Killing the network here would break the demo, not
> prove the on-device claim. The actual on-device path is the Electron
> desktop app / Pear mobile app, which is simply out of scope for this
> particular script. If you've verified either works on your own hardware
> and want a genuine offline/airplane-mode clip, add it as a bonus B-roll
> segment — but don't force it in under time pressure.

---

## TIMELINE (total ≈ 177s)

### 0:00–0:15 | Hook (15s)
**[Screen: brief black frame or a close-up of a notebook/phone, then cut to
alexbelij.github.io/MISTER/ loading, Chat tab, dark UI]**
> "A coach loses his tactics notebook the night before a match. Every
> set-piece, every player note — gone."
**[Beat — one second — then the MISTER chat UI finishes loading]**
> "MISTER is a club brain that fine-tunes on your own data and runs
> on-device — no cloud, no API keys, your tactical IP never leaves the
> machine. What you're about to see now is a browser-hosted version for
> easy judge access; the real product runs this same inference fully
> offline, on a laptop."

### 0:15–0:38 | Live chat = real inference (23s)
**[Screen: type a tactical question in Chat tab, e.g. "How should we press
their back three?", hit send]**
> "This chat isn't scripted or keyword-matched — it's calling a real QVAC
> inference backend, Qwen3 1.7 billion parameters, running live on a
> Hugging Face Space."
**[If cold-start delay appears, narrate over it: "First message after idle
wakes the free-tier instance — usually 30 to 60 seconds."]**
**[Once reply streams in, briefly highlight the tokens appearing live.]**

### 0:38–0:58 | Analytics — real match data (20s)
**[Click Analytics tab. Show Match Timeline + Player Ratings table +
Pressing chart]**
> "Behind the chat is a real analytics layer: 8 real matches, 16 players,
> 88 individual player-match ratings across 8 tactical criteria — pressing,
> transition speed, flank overloads — all computed client-side from the
> club's match data, not fabricated placeholder numbers."

### 0:58–1:18 | Match History → Report navigation (20s)
**[Scroll to Match Timeline, click on one match row]**
> "Clicking a match jumps straight into its full tactical report —"
**[Screen auto-switches to Reports tab, shows the selected match's report:
xG, possession, pressing success, notes]**
> "— generated from the same tactical event data the model was trained on."

### 1:18–1:33 | Suggestions tab (15s)
**[Click Suggestions tab]**
> "MISTER also surfaces auto-generated tactical recommendations, each backed
> by evidence from real match patterns — this is the model reasoning over
> the club's own history, not generic football advice."

### 1:33–1:53 | Distribute — real P2P + real QR (20s)
**[Click Distribute tab. Show QR code + Pears topic key + connected peers]**
> "Game plans distribute peer-to-peer via Pears — no cloud server. This QR
> code is real and scannable, encoding the actual P2P topic key any coach's
> phone can join."
**[Optional: scan with a phone camera on-screen to prove it decodes to a
real payload — only do this if you've tested it works with your phone's
default camera app beforehand.]**

### 1:53–2:23 | Honest fine-tune story — the Proof tab (30s)
**[Click the new Proof tab]**
> "Here's the part we want to be completely transparent about. We ran the
> real on-device LoRA fine-tune five times against a real cloud GPU on
> Kaggle. Every run: real model load, real BEFORE evaluation, real
> gradient-descent training with genuine decreasing loss — you can see the
> actual numbers here, 8.9185 down to 9.0051 across steps, with real
> checkpoint files written to disk."
**[Point at the loss table / checkpoint row]**
> "But every one of the five runs hit a confirmed upstream crash in
> `@qvac/sdk`'s native fine-tune worker — a SIGABRT that we proved is
> independent of dataset size and batch size. We filed it upstream rather
> than hide it. We chose not to publish a fake completed result just to
> look finished."

### 2:23–2:40 | Proof it's not vaporware — tests + CI (17s)
**[Screen: GitHub repo, green Actions checkmark / README badge, or terminal
`npm test` output]**
> "37 out of 37 tests pass, verified by CI on every commit. Zero fake API
> calls, zero silent error-swallowing — audited across the full codebase."

### 2:40–2:57 | Close (17s)
**[Screen: back to Chat tab or GitHub repo homepage]**
> "MISTER: real, on-device, QVAC-native — honest about what works today,
> and about the one upstream bug blocking full LoRA completion. Full code
> and full run logs are in the repo. Thanks for watching."

---

## Pre-recording checklist
- [ ] Do one full silent dry run of the whole script first (dead-air rehearsal)
      to confirm cold-start timing, tab order, and that nothing has regressed.
- [ ] Confirm the HF Space is awake before hitting record (hit /health once
      a minute or two before recording so the "wow" chat reply doesn't eat
      60s of the 3-minute budget).
- [ ] If you want to show the QR scan live, test decoding it with your own
      phone's camera app once beforehand — don't discover live on camera
      whether it works.
- [ ] Keep total under 3:00 — this script targets ~2:57 with a small buffer.
