# MISTER — Demo Video Script (≤ 3 minutes)

> This is the script for the 3-minute demo video required for the July 8 submission.
> Record with screen capture (OBS / QuickTime / Loom).
> Upload to YouTube as "unlisted" and put the link in the DoraHacks submission.

---

## TIMELINE

### 0:00 — 0:15 | Hook

**[Screen: MISTER app opening, dark UI]**

> "This is MISTER — a club brain that fine-tunes on your club's data, right on your device. No cloud, no API keys, your tactical IP never leaves the machine."

### 0:15 — 0:35 | Data + Onboarding

**[Screen: Show data files — club_profile.json, sft_pairs.json, causal_corpus.json]**

> "You load your club's materials — match notes, player profiles, training logs, your tactical philosophy. MISTER processes them into training data: 104 question-answer pairs in your club's voice, plus 20 raw text documents for vocabulary absorption."

> "For this demo, we're using FC Metall Nord — a fictional club with a 4-3-3 system built around verticality, pressing, and flank overloads."

### 0:35 — 1:15 | Training (The Wow Moment)

**[Screen: Click "Train Club Brain" → real progress stream from QVAC Fabric]**

> "Now the magic. MISTER uses QVAC Fabric to run LoRA fine-tuning directly on-device. A 1.7 billion parameter model learns your club's terminology, tactical logic, and speaking style."

**[Screen: Show training logs — loss decreasing, epochs progressing, checkpoints]**

> "The output is a tiny adapter file — about 12 megabytes. This is your club's brain. The whole process takes about 15 minutes on a laptop."

### 1:15 — 1:50 | BEFORE vs AFTER (The Proof)

**[Screen: Click "Run Enhanced Eval" → 3-layer eval table appears]**

> "Here's the proof. We run 15 hold-out questions — questions the model has never seen — on the base model and the fine-tuned model. Three scoring layers: lexical, embedding cosine similarity, and LLM-as-judge."

**[Screen: Show delta table with real numbers]**

> "The base model gives generic answers. The fine-tuned model uses our terminology — pressing trigger, channel run, rest-defence, transition lock. It thinks and speaks like FC Metall Nord."

**[Screen: Show side-by-side answer comparison]**

> "Ask 'What's our plan against SV Hafen United?' — the base model gives a generic football answer. The fine-tuned model says: 'First touch pressure on Mahler, Hartmann cuts the lane to Fass, channel runs because Fass can't recover.' That's our game model, in our words."

### 1:50 — 2:20 | Mobile App (Camera + Voice)

**[Screen: Switch to mobile app — Pear app on phone]**

> "MISTER also runs on mobile. On the training ground, the coach photographs handwritten match notes."

**[Screen: Camera → capture → OCR result appears]**

> "QVAC OCR extracts the text, structures it, and converts it into training data. The club brain learns from the coach's notebook."

**[Screen: Voice tab → tap microphone → speak → transcript appears → send to chat]**

> "Voice input — hands-free. Ask a question, get an answer in your club's voice. QVAC transcribe for STT, completion for the answer, textToSpeech for the response."

### 2:20 — 2:40 | P2P Distribution + Translate

**[Screen: Click "Share Adapter (P2P)" → show topic key / QR code]**

> "The adapter is distributed to your coaching staff via Pears — peer-to-peer, no server. Your assistant coach receives the same club brain on their device."

**[Screen: Settings → Translate → select Portuguese]**

> "And for clubs with international players, MISTER translates match briefings into 16+ languages — all on-device. A coach in Nigeria writes in English, a player from Brazil reads in Portuguese."

### 2:40 — 3:00 | Close

**[Screen: MISTER logo + key points]**

> "MISTER: on-device LoRA fine-tuning via QVAC Fabric, 40+ QVAC API calls, P2P distribution via Pears, OCR handwritten notes, voice briefing, footage analysis, tactical translator, AES-256 encryption, GDPR compliant. Your club's brain — literally in the weights."

**[Text on screen:]**
- 🧠 On-device LoRA fine-tuning (QVAC Fabric — 40+ APIs)
- 📡 P2P adapter distribution + inference delegation (Pears)
- 📸 OCR handwritten notes → training data
- 🎙️ Voice briefing + voice input (QVAC TTS/STT)
- 🌍 16+ language translator for multinational squads
- 🔒 AES-256 encryption, GDPR/CCPA compliant
- ⚽ Built for Tether Developers Cup

---

## RECORDING TIPS

1. **Use the demo dataset** (FC Metall Nord) — it's designed to show clear BEFORE/AFTER contrast
2. **Pre-run the training** before recording — don't make the viewer wait 15 minutes
3. **Show the eval table** — this is your Moneyball proof, the most important slide
4. **Show a side-by-side answer** — base model vs fine-tuned, same question. The difference should be visible
5. **Show the mobile app** — camera OCR and voice input are killer features that no competitor has
6. **Keep it under 3 minutes** — judges watch many demos. Be concise.
7. **No talking head** — screen capture + voiceover is enough
8. **Upload as YouTube unlisted** — put the link in your DoraHacks submission
