<div align="center">

# MISTER 🧠⚽

**Your club's tactical brain — private, on-device, and speaks your football.**

*Fine-tune a small LLM on your own game model. Offline. Peer-to-peer. Zero cloud, zero leaks.*

[![tests](https://github.com/alexbelij/MISTER/actions/workflows/tests.yml/badge.svg)](https://github.com/alexbelij/MISTER/actions/workflows/tests.yml)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![PWA](https://img.shields.io/badge/PWA-installable-brightgreen.svg)](https://alexbelij.github.io/MISTER/)
[![runs on-device](https://img.shields.io/badge/inference-on--device-blue.svg)](https://docs.qvac.tether.io/)
[![P2P sync](https://img.shields.io/badge/sync-peer--to--peer-8b5cf6.svg)](https://pears.com/)

**[▶️ Try the live demo](https://alexbelij.github.io/MISTER/)** &nbsp;·&nbsp;
**[⚙️ Run it locally](#run-the-real-thing)** &nbsp;·&nbsp;
**[🔬 See the proof](https://alexbelij.github.io/MISTER/#proof)**

</div>

---

## Why MISTER

> [!TIP]
> Elite clubs pay six figures a year for tactical intelligence tools. Everyone else opens a spreadsheet.
> MISTER is the third option: a **coach-grade AI that runs on your laptop, learns from your own match data, and never phones home**.

Modern coaching data is a paradox. Every touch, every press trigger, every substitution is captured — and yet the tools that read it are locked behind SaaS gates, per-seat licences, and cloud pipelines that quietly ship your IP to somebody else's servers.

MISTER flips the model. **You bring the data. The model comes to you.** A small language model is fine-tuned locally on your club's own game plan, opponent scouting, player profiles, and match notes — then serves briefings, reports and answers directly on your machine.

- 🧠 **The model *becomes* the club.** Terminology, principles, decision-making style — all baked into the weights.
- 🔒 **Private by architecture.** Fine-tuning, inference and distribution happen on-device or over P2P. No API keys, no cloud, no data broker.
- 📡 **Sync without a server.** Adapters (tiny `.gguf` files) travel to your assistants and analysts over Pears P2P — no cloud storage bill, no login flow.
- ⚡ **Installable as an app.** The demo is a PWA — open it, add to home screen, works offline.

## What it does (quick tour)

| For… | You get… |
|---|---|
| 🎯 **The head coach** | A voice-briefing before every match, in your club's tactical language |
| 📋 **The analyst** | A private LLM that reads your match reports and player profiles and stays quiet outside the tunnel |
| 📸 **The assistant** | OCR of handwritten notes → training data; camera-based footage tagging |
| 🌍 **Multinational squads** | 16+ language briefings, generated locally |
| 💻 **The IT lead** | Air-gapped-friendly, self-hostable, MIT-licensed |

## Try it in 30 seconds

**Web demo (no install):** <https://alexbelij.github.io/MISTER/>

The demo is a working slice of the product — chat with the on-device backend, browse squad + opponent analytics, generate a per-match report, and inspect the training-run proofs. Install it as a PWA and it will keep working offline.

> [!NOTE]
> The chat tab calls a genuinely running on-device QVAC inference backend (`Qwen3-1.7B`). The first message after idle can take ~30–60 s because the free-tier host cold-starts a container. Analytics, reports, proofs and the P2P share flow are always instant.

## Feature highlights

| # | Capability | Under the hood |
|---|---|---|
| 1 | 🧠 On-device LoRA fine-tuning | QVAC Fabric |
| 2 | 📊 3-layer eval (lexical + semantic + LLM judge) | QVAC `embed` + `completion` |
| 3 | 🎙️ Voice match briefing (spoken) | QVAC `textToSpeech` |
| 4 | 🎤 Voice input (hands-free ask) | QVAC `transcribe` |
| 5 | 🎬 Match-frame analysis | QVAC VLM via `completion` |
| 6 | 📸 OCR of handwritten notes → SFT pairs | QVAC `ocr` |
| 7 | 🌍 Tactical translator (16+ languages) | QVAC `translate` |
| 8 | 📡 P2P inference delegation (phone → laptop) | Pears Hyperswarm |
| 9 | 🤝 Collaborative game model (multi-writer log) | Pears Autobase |
| 10 | 📡 Adapter distribution (staff sync) | Pears Hyperswarm / Hyperblobs |
| 11 | 💰 Adapter marketplace (gasless USDt) | WDK ERC-4337 |
| 12 | 📊 Game-model-native player ratings | Local scoring |
| 13 | ⚔️ Opponent pattern tracker | Local analysis |
| 14 | 🤖 Multi-agent fallback (Scout/Tactics/Player/Install) | QVAC `completion` |
| 15 | 📈 Data augmentation (paraphrase + scenarios) | Local pipeline |
| 16 | 📱 Mobile Pear app | Pear runtime |
| 17 | 🔒 AES-256-GCM at-rest encryption | Node.js `crypto` |
| 18 | 🛡️ GDPR / CCPA / APPI / PDPA-friendly design | — |
| 19 | ⏸️ Suspend / resume / cancel fine-tuning | QVAC state APIs |
| 20 | 🌊 Streaming chat (token-by-token) | QVAC events |
| 21 | 🏥 Provider health check | QVAC `heartbeat` |
| 22 | 🔍 Hardware-aware model selection | QVAC `modelRegistrySearch` |
| 23 | 🖼️ Frame upscaling before VLM | QVAC `upscale` |
| 24 | 🗑️ Secure deletion (overwrite + unlink) | Node.js `crypto` |
| 25 | 📋 Audit log for compliance | Structured JSON |
| 26 | 📦 PCM → WAV conversion for TTS playback | Local codec |
| 27 | 🔄 Full RAG workspace lifecycle | QVAC `rag*` |

## Architecture

```
Desktop (Electron)                       Mobile (Pear app)
┌──────────────────────┐                 ┌──────────────────────┐
│ UI (React)           │                 │ UI (touch-first)      │
│ ├── Train Club Brain │                 │ ├── Chat (streaming)  │
│ ├── Eval Panel       │                 │ ├── Camera (OCR/VLM)  │
│ ├── Footage Analysis │                 │ ├── Voice (STT/TTS)   │
│ ├── Player Ratings   │                 │ ├── QR Exchange       │
│ ├── Opponent Tracker │                 │ ├── Settings          │
│ ├── Marketplace      │                 │ └── P2P Delegate      │
│ └── Collab Game Model│                 └──────────────────────┘
└──────────────────────┘                          │
        │                                         │  P2P (Hyperswarm)
        │  qvac_wrapper.js                         │
        ▼                                         ▼
┌──────────────────────────────────────────────────────────────┐
│ QVAC SDK  (40+ APIs — LLM / VLM / TTS / STT / NMT / OCR /    │
│           Embed / Diffusion / Registry / Finetune / RAG)      │
└──────────────────────────────────────────────────────────────┘
        │                                         │
        ▼                                         ▼
┌──────────────────────┐              ┌──────────────────────┐
│ Pears (P2P)          │              │ Security              │
│ ├── Hyperswarm (DHT) │              │ ├── AES-256-GCM       │
│ ├── Hyperblobs       │              │ ├── PBKDF2 (100k)     │
│ ├── Autobase         │              │ ├── Secure delete     │
│ └── Corestore        │              │ └── Audit log         │
└──────────────────────┘              └──────────────────────┘
        │
        ▼
┌──────────────────────┐
│ WDK (Wallet)         │
│ ├── Self-custody     │
│ ├── Gasless USDt     │
│ └── Adapter market   │
└──────────────────────┘
```

## Run the real thing

```bash
git clone https://github.com/alexbelij/MISTER.git
cd MISTER
npm install                  # Node 20+
npm run gate                 # Day-0 GATE: prepare → LoRA finetune → eval
npm run chat -- \            # Chat with your club brain (streaming)
  --adapter adapters/adapter.gguf
npm run ui                   # Desktop UI (Electron)
npm run mobile               # Mobile UI (Pear app)
```

Full CLI (voice briefing, footage analysis, translation, marketplace, GDPR export, …) lives inside `package.json` scripts — run `npm run` to list them.

## Training profiles

| Profile | Epochs | Time | Use when… |
|---|---|---|---|
| `gate` | 2 | 5–10 min | Day-0 validation — does fine-tuning work on this dataset? |
| `standard` | 3 | 10–20 min | Production run — balanced speed and quality |
| `deep` | 5 | 20–40 min | Final build — maximum quality |
| `style_only` | 2+3 causal | 10–15 min | Facts are fine, only style needs work |

## The evidence bar

We publish evals, checkpoints, run logs and the append-only Pears hypercore snapshot next to the code. If a number is on the page, it is either measured or clearly labelled as an example.

### Eval harness (illustrative output)

```
Metric              BEFORE    AFTER    DELTA
─────────────────────────────────────────────
Terminology         0.12      0.68     +0.56
Principle Align     0.25      0.75     +0.50
Style Match (embed) 0.22      0.61     +0.39
LLM Judge           2.10      4.20     +2.10
TOTAL               0.17      0.66     +0.49
```

> [!NOTE]
> **Real status of the AFTER eval.** Across 5 real fine-tune attempts on Kaggle (Tesla P100), the BEFORE eval completed every time (real model, real inference) and real gradient-descent training started with genuine decreasing loss — but the `@qvac/sdk` native fine-tune worker exits with `SIGABRT` before writing the adapter. The bug is reproducible across dataset/batch sizes, our code is ruled out, and it has been reported upstream with a minimal repro. The retry / resume logic is in place and will pick up the moment the SDK ships a fix. Real BEFORE-eval and decreasing-loss logs are pinned inside the [Proof tab](https://alexbelij.github.io/MISTER/#proof).

### Roadmap

- **Q3 26** — AFTER-eval delta table once the upstream SDK patch lands. Voice briefing on mobile.
- **Q4 26** — Multi-role write-scopes (head coach / analyst / player) with attribution and rollback.
- **Q1 27** — WDK adapter marketplace: buy / sell tuned club brains with gasless USDt.
- **Ongoing** — More opponent types, more languages, more scouting integrations.

## Repo layout

```
mister/
├── demo/                # Web demo (PWA) — this is what alexbelij.github.io/MISTER/ serves
├── src/
│   ├── utils/           # qvac_wrapper.js  — 40+ API surface, single source of truth
│   ├── pipeline/        # data prep + augmentation
│   ├── finetune/        # LoRA fine-tuning via QVAC Fabric
│   ├── inference/       # streaming chat + RAG engine + multi-agent fallback
│   ├── eval/            # 3-layer eval harness
│   ├── voice/           # TTS briefings, STT input
│   ├── analysis/        # footage VLM, player ratings, opponent tracker
│   ├── ocr/             # handwritten notes → SFT pairs
│   ├── translate/       # 16+ languages
│   ├── pears/           # P2P distribution + inference delegation + collab game model
│   ├── wdk/             # adapter marketplace
│   ├── model_registry/  # hardware-aware model selection
│   └── security/        # AES-256, secure delete, audit log
├── mobile/              # Pear app (touch-first UI)
├── ui/                  # Desktop UI (Electron)
├── data/                # Sample club dataset (FC Metall Nord)
├── eval/                # Hold-out set + results
└── tests/               # Unit + integration tests
```

## Community & governance

- **[Contributing](CONTRIBUTING.md)** — how to file a bug, ship a fix, propose a feature.
- **[Security](SECURITY.md)** — private disclosure process (please don't open a public issue for a vulnerability).
- **[Code of Conduct](CODE_OF_CONDUCT.md)** — the community standard we hold each other to.
- **[Privacy](PRIVACY.md)** — what's stored, where, and for how long (spoiler: locally, briefly).

## Licence

[MIT](LICENSE) — build on it, ship it, sell it. Just keep the notice.

---

<div align="center">

**Coaching intelligence belongs to the coach.**
Not to a SaaS vendor, not to a cloud, not to a data broker.

<sub>Built with ❤️ for the people who read match tape at 2am.</sub>

</div>
