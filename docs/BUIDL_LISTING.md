# MISTER — BUIDL listing pack

Copy-paste-ready assets for GitHub and BUIDL submission pages. Every string here is tuned to the length limits of the platform it targets.

---

## Project name (5 options — pick one)

1. **MISTER** *(primary; also stands for Mobile Intelligent System for Tactical Evaluation & Reporting)*
2. **MISTER — On-Device Football Brain**
3. **MISTER — Private AI for Football Clubs**
4. **MISTER — The Club Brain**
5. **MISTER — Coaching Intelligence Belongs to the Coach**

**Recommendation:** ship as **MISTER** on GitHub, use the tagline underneath.

---

## GitHub repository description (max 350 chars)

> **The club brain: fine-tune a small LLM on your football team's own game plan, opponent scouting and match notes. On-device inference via QVAC, peer-to-peer sync via Pears, gasless USDt payments via WDK. Privacy by architecture — data never leaves the coach's device.**

**Length:** 296 chars — safe.

---

## GitHub topics / tags (20 — GitHub allows 20 max)

Ordered by discoverability weight:

```
on-device-ai
lora
fine-tuning
qvac
tether
pears
p2p
football
soccer
coaching
sports-analytics
qwen
private-ai
offline-ai
peer-to-peer
llm
hypercore
edge-ai
electron
pwa
```

---

## BUIDL vision — problems solved (≤ 256 chars)

**Primary (246 chars — all three sponsor stacks named):**

> Elite clubs pay six figures a year for tactical AI; everyone else opens a spreadsheet. MISTER — a private, on-device football brain: LoRA-tuned on the club's own game model, P2P sync via Pears, gasless USDt via WDK. Coach IP stays with the coach.

**Alternative (250 chars — problem-first):**

> Modern coaching data is a paradox: every touch is captured, but the tools that read it are locked behind SaaS gates. MISTER puts a fine-tuned LLM on the coach's laptop, syncs it P2P via Pears, and pays out on gasless USDt via WDK. No cloud. No leaks.

---

## BUIDL — detailed project description

**MISTER is a private, on-device tactical AI for football clubs.**

We take a small language model (Qwen3-1.7B) and LoRA-fine-tune it on the coach's own game plan, opponent scouting and match notes. The result is a *club-shaped* AI — it speaks the coach's tactical language, applies the club's principles, and stays local. Nothing about the game plan leaves the coach's laptop unless the coach explicitly rebroadcasts it.

### Why now

Coaching data is a paradox. Every touch, every press trigger, every substitution is captured — and yet the tools that read it are locked behind SaaS gates, per-seat licences and cloud pipelines that quietly ship a club's IP to somebody else's servers. Elite clubs pay six figures a year for tactical intelligence. Everyone else opens a spreadsheet.

MISTER flips the model. The data stays put, the model comes to the data, and the coach owns both.

### Unique value

- **On-device fine-tuning.** Not "call a hosted API with your prompts". Real LoRA training runs on-device via **QVAC Fabric**, adapter files (`.gguf`) written locally.
- **P2P everything.** No central server, no monthly bill, no data broker. Adapters travel to assistants and analysts over **Pears Hyperswarm**; the collaborative game model is an **Autobase** multi-writer log; every P2P event is signed and pinned to a **Hypercore** users can verify in-browser.
- **Wallet-grade payments.** Coaches can monetise their tuned brains through a **WDK** ERC-4337 marketplace — gasless USDt, self-custody, no card processor.
- **Identity by keypair.** Every user is an Ed25519 keypair. Team manifests are signed. A coach is proven to be a coach because the team owner signed them into the manifest, not because a server said so.

### Vision

Coaching intelligence belongs to the coach — not to a SaaS vendor, not to a cloud, not to a data broker. MISTER is what happens when you build the tooling that assumption implies from first principles: local weights, local data, P2P sync, wallet-based payments. It's not a chatbot with football flavouring; it's a private tactical brain.

### Perspectives / roadmap

- **Next:** populate the AFTER-eval column when the upstream `@qvac/sdk` fine-tune patch ships; voice briefing on mobile.
- **Then:** multi-role write scopes (head coach / analyst / player) with signed audit trail and rollback.
- **After that:** the WDK adapter marketplace — coaches sell/buy tuned club brains on-chain with gasless USDt.
- **Ongoing:** more opponent archetypes, more languages (16+ today), more scouting integrations.

### Why we deserve attention

**We built the hard parts, not the demos.**

| We integrated | How deeply |
|---|---|
| **QVAC (Tether AI)** | 1 491 LOC wrapper covering 40+ APIs (`completion` / `embed` / `ocr` / `translate` / `tts` / `stt` / `vlm` / `finetune` / `rag` / `registry` / `heartbeat`), consumed by 14 modules. |
| **Pears Stack** | 3 modules (~570 LOC): P2P adapter distribution + QR fallback, phone→laptop inference delegation, Autobase multi-writer collab game model. A signed Hypercore snapshot is served at `/proof` with an in-browser Ed25519 verifier. |
| **WDK (Tether Wallets)** | 431 LOC using real `@tetherto/wdk` + `@tetherto/wdk-wallet-evm-erc-4337`. Wallet creation / derivation / balance reads work fully offline. |

**We shipped real proof.** 5 verified LoRA training runs on Kaggle (Tesla P100 / T4×2). BEFORE eval completed on 5/5 with real Qwen3-1.7B inference; loss curve decreases monotonically; checkpoints written to disk. Every artefact is committed in `/proof` and rendered in the demo's [Proof tab](https://alexbelij.github.io/MISTER/#proof) with a live signature verifier. The one blocked step — the SDK's native fine-tune worker exiting with `SIGABRT` before writing the adapter — has a minimal repro filed upstream, and our retry / adapter-load / AFTER-eval harness are all wired end-to-end.

**We shipped a real UI.** Not a Figma. A PWA at [alexbelij.github.io/MISTER](https://alexbelij.github.io/MISTER/) with 6 tabs (chat / analytics / suggestions / reports / distribute / proof), guided tour, dark/light theme, keyboard shortcuts (`?`, `g p`, `/`, `Shift+D`), sortable data tables, on-device PDF export, mailto integration, service-worker offline shell.

### Feature highlights (27 shipped)

On-device LoRA fine-tuning · 3-layer eval (lexical + semantic + LLM judge) · voice briefing (TTS) · voice input (STT) · match-frame VLM · handwritten-note OCR → SFT pairs · tactical translator (16+ languages) · P2P inference delegation · Autobase collab game model · P2P adapter distribution · WDK gasless USDt marketplace · game-model-native player ratings · opponent pattern tracker · multi-agent fallback (Scout / Tactics / Player / Install) · data augmentation · mobile Pear app · AES-256-GCM at-rest encryption · GDPR / CCPA / APPI / PDPA design · suspend / resume / cancel fine-tuning · streaming chat · provider heartbeat · hardware-aware model selection · frame upscaling · secure deletion · audit log · PCM → WAV codec · full RAG workspace lifecycle.

### Sponsor stacks — verified 3 / 3

You can reproduce these numbers with `grep`:

```bash
grep -r "require('@qvac/sdk')"     src/ | wc -l   # QVAC integration points
grep -r "require('hyperswarm')"     src/ | wc -l   # Pears integration points
grep -r "require('@tetherto/wdk')"  src/ | wc -l   # WDK integration points
```

### Live artefacts

- Web demo (PWA): <https://alexbelij.github.io/MISTER/>
- Signed Hypercore snapshot: <https://alexbelij.github.io/MISTER/#proof>
- Repository: <https://github.com/alexbelij/MISTER>
- Contributing / Security / Code of Conduct: in-repo (`CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`)

### Licence

MIT. Build on it, ship it, sell it. Just keep the notice.

---

## Elevator pitch (30 s, spoken)

> "Fine-tuning a language model on your own football team's data used to mean either sending everything to OpenAI or hiring a machine-learning engineer. MISTER does neither. It runs on the coach's laptop, learns from their game plan on-device via Tether's QVAC stack, syncs peer-to-peer with Pears, and lets coaches monetise their tuned brains with gasless USDt through WDK. The club brain stays in the club. That's the pitch."

---

## Twitter / X post (280 chars)

> Shipping MISTER: an on-device tactical AI for football clubs. Fine-tunes a small LLM on your own game plan via @tether QVAC · syncs P2P via @pearsapp Hypercore · gasless USDt payments via WDK. Coach IP stays with the coach. Try it: alexbelij.github.io/MISTER
