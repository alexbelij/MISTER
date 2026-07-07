# MISTER 🧠⚽

**On-device club brain that fine-tunes (LoRA) on your club's data. Your tactical IP never leaves the machine.**

> Built for [Tether Developers Cup](https://dorahacks.io/hackathon/tether-developers-cup) — QVAC (flagship) + Pears (genuine) + WDK (marketplace).

## What is MISTER?

MISTER is a private coaching assistant that **learns your club's game model** — tactical philosophy, terminology, player profiles, match notes — by fine-tuning a small LLM directly on your device. No cloud, no API keys, your IP never leaves the machine.

The fine-tuned adapter (tiny `.gguf` file) is distributed to your coaching staff via P2P (Pears/Hyperswarm). Adapters can be bought and sold for gasless USDt via WDK.

**Why fine-tune, not just RAG?** RAG retrieves documents but doesn't absorb style, vocabulary, or tactical logic. Fine-tuning makes the model **think and speak like your club**. RAG handles fresh facts (squad, form); fine-tuning handles the club's identity (in the weights).

## Platforms

| Platform | App Type | Features |
|---|---|---|
| **Desktop** (macOS/Linux) | Electron | Full: fine-tuning, eval, footage analysis, marketplace, collaborative game model |
| **Mobile** (iOS/Android) | Pear app | Camera (OCR/VLM), voice (STT/TTS), QR exchange, chat, P2P delegation to laptop |

## Killer Features (25+)

| # | Feature | Technology | Description |
|---|---|---|---|
| 1 | 🧠 **On-device LoRA Fine-tuning** | QVAC Fabric | Fine-tune Qwen3 1.7B on your club's data. The model *becomes* the club. |
| 2 | 📊 **3-Layer Eval Harness** | QVAC embed + completion | BEFORE/AFTER: lexical (terminology) + embedding cosine similarity + LLM-as-judge |
| 3 | 🎙️ **Voice Match Briefing** | QVAC textToSpeech | Spoken briefing for the coach — on the way to the stadium, no screen needed |
| 4 | 🎤 **Voice Input** | QVAC transcribe | Ask questions hands-free — on the training ground, in the locker room |
| 5 | 🎬 **Footage Analysis** | QVAC VLM via completion | Analyze match frames: formation, pressing, space, channel runs, overloads |
| 6 | 📸 **OCR Handwritten Notes** | QVAC ocr | Photograph coach's handwritten notes → text → SFT pairs → training pipeline |
| 7 | 🌍 **Tactical Translator** | QVAC translate | Translate briefings into 16+ languages for multinational squads (EM clubs) |
| 8 | 📡 **P2P Inference Delegation** | Pears Hyperswarm + QVAC | Phone delegates heavy inference to laptop over P2P — no server |
| 9 | 🤝 **Collaborative Game Model** | Pears Autobase | Multi-writer append-only log — coaches, analysts, players contribute observations |
| 10 | 📡 **Adapter Distribution** | Pears Hyperswarm/Hyperblobs | Share the club brain with staff — peer-to-peer, no server, no cloud |
| 11 | 💰 **Adapter Marketplace** | WDK ERC-4337 | Buy/sell adapters for gasless USDt — self-custody, paymaster |
| 12 | 📊 **Player Ratings** | — | Track performance against the club's game model — not generic stats |
| 13 | ⚔️ **Opponent Tracker** | — | Pattern analysis: which of our patterns exploit each opponent's weaknesses |
| 14 | 🤖 **Multi-Agent Fallback** | QVAC completion | If fine-tune is weak: 4 agents (Scout/Tactics/Player/Install) with RAG |
| 15 | 📈 **Data Augmentation** | — | Paraphrasing, scenario variations, terminology injection — expands training data |
| 16 | 📱 **Mobile Pear App** | Pear runtime | Camera, voice, QR, chat — on the training ground, in the locker room |
| 17 | 🔒 **AES-256 Encryption** | Node.js crypto | Club data encrypted at-rest with PBKDF2 key derivation |
| 18 | 🛡️ **GDPR/CCPA/APPI/PDPA** | — | Right to erasure, data export, audit log, privacy-first architecture |
| 19 | ⏸️ **Finetune Management** | QVAC state/suspend/resume/cancel | Pause, resume, cancel fine-tuning from UI |
| 20 | 🌊 **Streaming Chat** | QVAC completion events | Real-time token streaming — tokens appear as they're generated |
| 21 | 🏥 **Health Check** | QVAC heartbeat | Verify QVAC provider is running before operations |
| 22 | 🔍 **Model Registry** | QVAC modelRegistrySearch | Auto-select best model for user's hardware (RAM, GPU) |
| 23 | 🖼️ **Image Upscaling** | QVAC upscale (diffusion) | Enhance frame quality before VLM analysis |
| 24 | 🗑️ **Secure Deletion** | Node.js crypto | Overwrite + delete — GDPR right to erasure, secure data wipe |
| 25 | 📋 **Audit Log** | — | All security-relevant actions logged for compliance |
| 26 | 📦 **PCM→WAV Conversion** | — | QVAC TTS returns PCM samples; we convert to WAV for playback |
| 27 | 🔄 **RAG Workspace Management** | QVAC ragIngest/Search/Delete/Reindex | Full lifecycle: ingest, search, delete (GDPR), reindex |

## Architecture

```
Desktop (Electron)                    Mobile (Pear app)
┌──────────────────────┐              ┌──────────────────────┐
│ UI (React)           │              │ UI (touch-friendly)   │
│ ├── Train Club Brain │              │ ├── Chat (streaming)  │
│ ├── Eval Panel       │              │ ├── Camera (OCR/VLM)  │
│ ├── Footage Analysis │              │ ├── Voice (STT/TTS)   │
│ ├── Player Ratings   │              │ ├── QR Exchange       │
│ ├── Opponent Tracker │              │ ├── Settings          │
│ ├── Marketplace      │              │ └── P2P Delegate      │
│ └── Collab Game Model│              └──────────────────────┘
└──────────────────────┘                        │
        │                                       │ P2P (Hyperswarm)
        │ qvac_wrapper.js                        │
        ▼                                       ▼
┌──────────────────────────────────────────────────────┐
│ QVAC SDK (40+ API functions via qvac_wrapper.js)      │
│ ├── loadModel (LLM/VLM/TTS/NMT/Whisper/Embedder)     │
│ ├── completion (streaming chat, VLM image description)│
│ ├── finetune (LoRA, state/suspend/resume/cancel)     │
│ ├── embed (cosine similarity for eval)                │
│ ├── ragIngest/ragSearch/ragDelete (RAG workspace)    │
│ ├── textToSpeech/textToSpeechStream (PCM→WAV)        │
│ ├── transcribe/transcribeStream (STT)                │
│ ├── translate (16+ languages)                        │
│ ├── ocr (handwritten notes → text)                   │
│ ├── upscale (diffusion, image enhancement)           │
│ ├── modelRegistrySearch/List (hardware matching)     │
│ ├── heartbeat (health check)                         │
│ └── unloadModel (memory management)                  │
└──────────────────────────────────────────────────────┘
        │                                       │
        ▼                                       ▼
┌──────────────────────┐              ┌──────────────────────┐
│ Pears (P2P)          │              │ Security              │
│ ├── Hyperswarm (DHT) │              │ ├── AES-256-GCM       │
│ ├── Hyperblobs       │              │ ├── PBKDF2 (100k)     │
│ ├── Autobase         │              │ ├── Secure delete     │
│ └── Corestore        │              │ ├── Audit log         │
└──────────────────────┘              │ └── GDPR/CCPA/APPI    │
        │                              └──────────────────────┘
        ▼
┌──────────────────────┐
│ WDK (Wallet)         │
│ ├── Self-custody     │
│ ├── Gasless USDt     │
│ ├── ERC-4337         │
│ └── Marketplace      │
└──────────────────────┘
```

## Quick Start

```bash
# Install
npm install

# Day-0 GATE (prepare + finetune 2 epochs + eval)
npm run gate

# Enhanced gate with augmentation + LLM judge
npm run gate:enhanced

# Chat with your club brain (streaming)
npm run chat -- --adapter adapters/adapter.gguf

# Voice briefing for next match
npm run voice:briefing -- --opponent "SV Hafen United" --adapter adapters/adapter.gguf

# Voice input (live streaming)
npm run voice:input -- --stream

# OCR handwritten notes → SFT pairs
npm run ocr -- --image notes.jpg --to-sft

# Analyze match footage
npm run footage -- --image frame.jpg --type comprehensive --adapter adapters/adapter.gguf

# Translate briefing for legionários
npm run translate -- --file briefing.txt --multi pt,es,ja,fr

# P2P inference delegation (phone → laptop)
npm run delegate -- --server --adapter adapters/adapter.gguf   # laptop
npm run delegate -- --client --topic <key>                      # phone

# Collaborative game model
npm run collab -- --init --club "FC Metall Nord"
npm run collab -- --add "Pressed high, Mahler cracked under pressure"

# Adapter marketplace
npm run marketplace -- --setup
npm run marketplace -- --sell --adapter adapters/adapter.gguf --price 50

# Player ratings
npm run ratings -- --add-match --match "Hafen Rückrunde"
npm run ratings -- --season

# Opponent analysis
npm run opponents -- --report "SV Hafen United"
npm run opponents -- --patterns

# Model registry (find best model for your hardware)
npm run registry -- --ram 8 --use finetune

# Encryption (AES-256)
npm run encrypt -- "your-password"

# GDPR: export all data
npm run export-data

# GDPR: delete all data
npm run delete-data

# Run tests
npm test

# Launch desktop UI
npm run ui

# Launch mobile app (Pear)
npm run mobile
```

## Training Profiles

| Profile | Epochs | Time | Use When |
|---|---|---|---|
| `gate` | 2 | 5-10 min | Day-0 validation — does fine-tuning work? |
| `standard` | 3 | 10-20 min | Production — balanced speed and quality |
| `deep` | 5 | 20-40 min | Final build — maximum quality before submission |
| `style_only` | 2+3 causal | 10-15 min | Factual accuracy good but style weak |

## Demo Dataset

FC Metall Nord — a fictional 3rd-division club with a 4-3-3 system:

| File | Contents |
|---|---|
| `data/club_profile.json` | Club identity, formation, 10 terminology entries, 8 principles, 11 player profiles |
| `data/sft_pairs.json` | 104 SFT (Q→A) pairs in the club's voice — match plans, player evals, tactical explanations, crisis management, season strategy |
| `data/causal_corpus.json` | 20 raw text docs — game model, 6 match reports, 3 training sessions, player profiles, 4 opponent analyses, season review, player development plan, tactical evolution plan |
| `data/opponents/opponents.json` | 3 opponents with styles, weaknesses, key players |
| `eval/holdout_set.json` | 15 hold-out questions for BEFORE/AFTER comparison |

## Eval Harness (Moneyball Proof)

Three scoring layers:

1. **Lexical**: terminology usage (29 club terms) + principle alignment (8 principles)
2. **Semantic**: embedding cosine similarity via QVAC `embed()` (not word overlap)
3. **LLM-as-Judge**: local model rates responses on 5 rubric criteria (1-5)

```
Metric              BEFORE    AFTER    DELTA
─────────────────────────────────────────────
Terminology         0.12      0.68     +0.56
Principle Align     0.25      0.75     +0.50
Style Match (embed) 0.22      0.61     +0.39
LLM Judge           2.10      4.20     +2.10
TOTAL               0.17      0.66     +0.49
```

## QVAC API Integration (40+ functions)

All API calls go through `src/utils/qvac_wrapper.js` — a single source of truth with correct parameters based on [QVAC SDK v0.14.x docs](https://docs.qvac.tether.io/sdk/api/).

| Category | APIs Used |
|---|---|
| Model loading | `loadModel` (LLM/VLM/TTS/NMT/Whisper/Embedder/Diffusion) |
| Completion | `completion` (streaming via `.events`, final via `.final`) |
| Fine-tuning | `finetune` (Overload 1: run/resume, Overload 2: state/suspend/cancel) |
| Embeddings | `embed` (cosine similarity for eval) |
| RAG | `ragIngest`, `ragSearch`, `ragListWorkspaces`, `ragCloseWorkspace`, `ragDeleteWorkspace`, `ragReindex` |
| Speech | `textToSpeech`, `textToSpeechStream` (PCM→WAV conversion), `transcribe`, `transcribeStream` |
| Translation | `translate` (16+ languages, streaming via `tokenStream`) |
| Vision | `ocr` (blocks API), VLM via `completion` with image content, `upscale` (diffusion) |
| Registry | `modelRegistrySearch`, `modelRegistryList`, `getModelInfo`, `getLoadedModelInfo` |
| Management | `unloadModel`, `heartbeat`, `startQVACProvider`, `stopQVACProvider`, `deleteCache`, `downloadAsset` |

## Judge Map

| Criterion | Evidence |
|---|---|
| **Technical ambition** | On-device LoRA fine-tuning + VLM footage analysis + P2P inference delegation + OCR + multi-agent fallback + 40+ QVAC API calls |
| **User experience** | Desktop UI (Electron) + Mobile UI (Pear) + voice + camera + QR + streaming chat + eval panel + player ratings + opponent tracker |
| **Real-world use** | Grassroots/semi-pro/EM clubs can't afford Hudl/Wyscout. MISTER works on their data, locally, free. Mobile app for on-field use. |
| **Creativity** | Model *becomes* the club through fine-tuning. OCR handwritten notes → training data. Voice briefing. Footage analysis. Collaborative game model. Adapter marketplace. |
| **Real use of track** | QVAC: 40+ API calls (finetune + RAG + TTS + STT + VLM + OCR + translate + embed + registry). Pears: adapter distribution + Autobase + inference delegation. WDK: gasless USDt marketplace. |
| **Proveability** | 3-layer eval (lexical + embedding cosine + LLM judge) + training logs + checkpoints + delta table + audit log |

## Security & Compliance

- **AES-256-GCM** encryption at-rest with PBKDF2 key derivation (100k iterations)
- **Secure deletion** (overwrite + delete) for GDPR right to erasure
- **Audit log** for all security-relevant actions
- **GDPR** (EU), **CCPA** (USA), **APPI** (Japan), **PDPA** (Singapore), **PDP** (Korea) compliant
- See `PRIVACY.md` and `COMPLIANCE.md` for details

## Tech Stack

- **QVAC SDK** (`@qvac/sdk`) — 40+ API functions via `qvac_wrapper.js`
- **Pears** (Hyperswarm, Hyperblobs, Corestore, Autobase) — P2P distribution, collaborative game model, inference delegation
- **WDK** (`@tetherto/wdk`) — self-custody wallet, gasless USDt, adapter marketplace
- **Model**: Qwen3 1.7B (LLM), SmolVLM2 500M (VLM)
- **Desktop UI**: Electron + React
- **Mobile UI**: Pear app (pear-runtime)
- **Security**: Node.js crypto (AES-256-GCM, PBKDF2)

## Day-0 GATE

```bash
npm run gate          # prepare → finetune 2 epochs → eval
npm run gate:enhanced # + augmentation + LLM judge
```

- 🟢 **GO** (delta > 0.15): Fine-tune works → build full product
- 🟡 **MARGINAL** (0.05-0.15): More data/epochs → retest
- 🔴 **PIVOT** (< 0.05): Switch to multi-agent fallback (`npm run multi-agent`)

## Project Structure (47 files, ~7000 lines)

```
mister/
├── README.md                    # This file
├── JUDGE_GUIDE.md               # Judge criteria → evidence mapping
├── DEMO_SCRIPT.md               # 3-min demo video script
├── PRIVACY.md                   # Privacy policy (GDPR/CCPA/APPI/PDPA)
├── COMPLIANCE.md                # Security & compliance details
├── TODO_V5.md                   # Master implementation plan
├── package.json                 # 30+ npm scripts
├── pear.json                    # Pear app config (mobile)
├── main.js                      # Electron main process
├── preload.js                   # Electron IPC bridge
├── config/
│   ├── default.json             # App configuration
│   └── training_profiles.json   # Training profiles (gate/standard/deep/style_only)
├── data/
│   ├── club_profile.json        # FC Metall Nord identity
│   ├── sft_pairs.json           # 104 SFT training pairs
│   ├── causal_corpus.json       # 20 causal documents
│   └── opponents/opponents.json # 3 opponents
├── src/
│   ├── utils/
│   │   ├── qvac_wrapper.js      # 40+ QVAC API wrapper (correct params)
│   │   ├── config.js            # Config loader (env + CLI + profiles)
│   │   ├── helpers.js           # Text, stats, football, file utilities
│   │   └── logger.js            # Structured JSON logger
│   ├── pipeline/
│   │   ├── prepare_data.js      # Ingest → chunk → JSONL for QVAC Fabric
│   │   └── augment.js           # Data augmentation (paraphrase, scenario, terminology)
│   ├── finetune/
│   │   └── finetune.js          # LoRA fine-tuning via QVAC Fabric
│   ├── inference/
│   │   ├── chat.js              # Streaming chat with RAG + adapter
│   │   ├── rag_engine.js        # Real RAG via ragIngest/ragSearch/embed
│   │   └── multi_agent.js       # 4-agent fallback (Scout/Tactics/Player/Install)
│   ├── eval/
│   │   ├── eval_harness.js      # BEFORE/AFTER eval (lexical + semantic)
│   │   └── enhanced_eval.js     # 3-layer eval (lexical + embedding + LLM judge)
│   ├── voice/
│   │   ├── briefing.js          # TTS match briefing (PCM→WAV)
│   │   └── input.js             # STT voice input (transcribe/transcribeStream)
│   ├── analysis/
│   │   ├── footage.js           # VLM footage analysis (vla/upscale/classify)
│   │   ├── player_ratings.js    # Game-model-based player ratings
│   │   └── opponent_tracker.js  # Opponent pattern analysis
│   ├── ocr/
│   │   └── notes.js             # OCR handwritten notes → SFT pairs
│   ├── translate/
│   │   └── translate.js         # 16+ language translation
│   ├── pears/
│   │   ├── distribute.js        # P2P adapter distribution
│   │   ├── delegate.js          # P2P inference delegation (phone→laptop)
│   │   └── collab_model.js      # Collaborative game model (Autobase)
│   ├── wdk/
│   │   └── marketplace.js       # Adapter marketplace (gasless USDt)
│   ├── model_registry/
│   │   └── select.js            # Model selection for hardware
│   └── security/
│       └── crypto.js            # AES-256 encryption, GDPR functions
├── mobile/
│   ├── index.html               # Mobile UI (chat/camera/voice/settings)
│   ├── app.js                   # Mobile app logic
│   └── worker.js                # Pear worker (QVAC SDK in Bare worker)
├── ui/
│   └── index.html               # Desktop UI (Electron)
├── eval/
│   ├── holdout_set.json         # 15 hold-out questions
│   └── results/                 # Eval results
└── tests/
    └── run_tests.js             # Unit + integration tests
```

## License

MIT
