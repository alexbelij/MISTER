# MISTER — Privacy Policy

## Overview

MISTER is a privacy-first, on-device coaching assistant. Your club's data **never leaves your device**. There is no cloud, no server, no API keys, and no telemetry.

## Data Collection

**MISTER does not collect any data.** Period.

- No analytics
- No telemetry
- No crash reports sent to a server
- No usage tracking
- No IP logging

## Data Storage

All data is stored **locally on your device**:

| Data | Location | Encrypted |
|---|---|---|
| Club profile | `data/club_profile.json` | Optional (AES-256) |
| SFT training pairs | `data/sft_pairs.json` | Optional (AES-256) |
| Causal corpus | `data/causal_corpus.json` | Optional (AES-256) |
| Opponent data | `data/opponents/opponents.json` | Optional (AES-256) |
| LoRA adapter | `adapters/adapter.gguf` | Optional (AES-256) |
| RAG workspace | QVAC internal storage | Managed by QVAC SDK |
| Audit log | `logs/audit.jsonl` | Not encrypted (metadata only) |

## Data Encryption

When you set a password:
- All club data files are encrypted with **AES-256-GCM**
- Key is derived from your password using **PBKDF2** (100,000 iterations)
- Original files are **securely deleted** (overwritten + deleted)
- Only encrypted versions remain on disk

## Data Sharing

MISTER uses **P2P (peer-to-peer)** for adapter distribution:
- Adapters are shared directly between devices via Hyperswarm
- **No intermediary server** sees your data
- The P2P connection is **encrypted** by Hyperswarm
- You choose who to share with (via QR code or topic key)

## Your Rights (GDPR / CCPA / APPI / PDPA)

### Right to Access
- View all your data: `npm run export` or Settings → Export All Data

### Right to Erasure (Right to be Forgotten)
- Delete all data: Settings → Delete All Data
- Files are **securely overwritten** before deletion
- RAG workspaces are deleted via `ragDeleteWorkspace()`

### Right to Data Portability
- Export all data as JSON: Settings → Export All Data
- Includes: club profile, SFT pairs, causal corpus, opponents, audit log

### Right to Object
- MISTER processes no data automatically — you control everything
- No automated decision-making

### Data Minimization
- MISTER only stores what you explicitly load
- No background data collection
- No cookies, no local storage tracking

## Children's Privacy

MISTER is designed for coaching staff (18+). It does not knowingly collect any data from anyone.

## Changes to This Policy

We may update this policy. Changes are effective immediately upon updating the app.

## Contact

This is an open-source project for Tether Developers Cup. No contact data is collected.

## Compliance Summary

| Regulation | Status |
|---|---|
| GDPR (EU) | ✅ Data is local, encrypted, user-controlled |
| CCPA (California) | ✅ No data collected, no sharing |
| APPI (Japan) | ✅ Local storage, no cross-border transfer |
| PDPA (Singapore) | ✅ No personal data processed |
| PDP (South Korea) | ✅ Local processing, user consent via app usage |
