# MISTER — Compliance & Security

## Security Architecture

### Encryption at Rest
- **Algorithm:** AES-256-GCM (authenticated encryption)
- **Key derivation:** PBKDF2 with SHA-256, 100,000 iterations
- **Salt:** 32-byte random per encryption
- **IV:** 16-byte random per encryption
- **Auth tag:** 16-byte GCM authentication tag

### Secure Deletion
- Files are overwritten with random data, then zeros, then deleted
- Prevents recovery of sensitive club data

### P2P Security
- Hyperswarm connections are encrypted (Noise protocol)
- No intermediary server can see data
- Adapter exchange is peer-to-peer only

## Regulatory Compliance

### GDPR (General Data Protection Regulation — EU)

| Requirement | MISTER Implementation |
|---|---|
| Data minimization | Only stores user-loaded data, nothing automatic |
| Purpose limitation | Data used only for local fine-tuning and inference |
| Storage limitation | User controls deletion at any time |
| Integrity & confidentiality | AES-256-GCM encryption at rest |
| Right to access | Export All Data feature |
| Right to erasure | Delete All Data (secure overwrite + delete) |
| Right to portability | JSON export of all data |
| Right to object | No automated processing, user initiates all actions |
| Data Protection by Design | Privacy-first architecture, no cloud |
| Data Protection by Default | No data collected without explicit user action |
| Cross-border transfer | None — data never leaves the device |

### CCPA (California Consumer Privacy Act — USA)

| Requirement | MISTER Implementation |
|---|---|
| Right to know | Export All Data shows all stored data |
| Right to delete | Delete All Data feature |
| Right to opt-out | No data sold or shared with third parties |
| Non-discrimination | All features available without data sharing |

### APPI (Act on the Protection of Personal Information — Japan)

| Requirement | MISTER Implementation |
|---|---|
| Purpose of use | Clearly stated: local coaching assistant |
| Third-party provision | None — no data shared without explicit P2P action |
| Cross-border transfer | None — all processing is local |
| Security measures | AES-256-GCM encryption, secure deletion |

### PDPA (Personal Data Protection Act — Singapore)

| Requirement | MISTER Implementation |
|---|---|
| Consent | User explicitly loads data, no automatic collection |
| Purpose limitation | Data used only for local AI fine-tuning |
| Notification | Privacy Policy clearly states data practices |
| Protection | AES-256-GCM encryption, P2P encryption |
| Retention | User controls deletion |

### PDP (Personal Data Protection — South Korea)

| Requirement | MISTER Implementation |
|---|---|
| Consent for processing | User explicitly loads all data |
| Local processing | All AI processing on-device |
| Security measures | AES-256-GCM, secure deletion, P2P encryption |
| Right to access/export | Export All Data feature |

## Audit Trail

All security-relevant actions are logged to `logs/audit.jsonl`:

```json
{"timestamp":"2026-07-07T12:00:00Z","action":"encrypt","file":"club_profile.json"}
{"timestamp":"2026-07-07T12:01:00Z","action":"decrypt","file":"club_profile.json"}
{"timestamp":"2026-07-07T12:02:00Z","action":"delete","file":"sft_pairs.json"}
{"timestamp":"2026-07-07T12:03:00Z","action":"export","path":"club_data_export.json"}
```

## Security Best Practices for Users

1. **Set a password** — encrypts all club data at rest
2. **Use QR exchange** — faster and more secure than copying keys
3. **Delete data before selling device** — use Delete All Data
4. **Keep adapter private** — it contains your club's tactical IP
5. **Review audit log** — check `logs/audit.jsonl` for access history
