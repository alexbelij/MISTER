# Security Policy

We take the security of MISTER seriously and appreciate responsible disclosure.

## Supported versions

Security fixes are provided for the versions below. Older versions should upgrade.

| Version | Supported |
|---|---|
| main branch (`HEAD`) | ✅ |
| latest tagged release | ✅ |
| older releases | ❌ |

## Reporting a vulnerability

**Please do NOT open a public issue, PR, or Discussion for security problems.**

Report privately through one of:

- **GitHub Private Vulnerability Reporting** (preferred) — the *Report a vulnerability* button under this repo's **Security** tab.
- **Email** — `security@mister.app` — encrypted mail welcome; ask for our PGP key first.

Please include as much of the following as you can:

- Type of issue and **impact** (what an attacker can achieve).
- **Affected version(s)** and configuration (desktop app / mobile Pear app / web demo).
- **Steps to reproduce** or a minimal proof-of-concept.
- Any suggested fix or mitigation.

A clear, reproducible report helps us triage and ship a fix faster, and lets us credit you accurately.

## What to expect (our commitment)

| Stage | Target |
|---|---|
| Acknowledge your report | within 3 business days |
| Initial assessment & severity | within 7 business days |
| Fix or mitigation plan | shared as soon as scope is clear |
| Coordinated public disclosure | typically within **90 days** of the report |

We follow **coordinated disclosure** — we work with you on a fix in a private GitHub Security Advisory, request a **CVE** where appropriate, and disclose once a patch is available (or the deadline is reached). We will credit reporters who want to be named.

## Scope

**In scope** — anything shipped from this repository: the desktop app (Electron), the mobile Pear app, the web demo (`/demo`), the training/eval pipeline, the QVAC wrapper, and the P2P distribution surface.

**Out of scope (unless configured by us)** — third-party dependencies (report upstream, we track them via Dependabot), volumetric DoS, social engineering, and issues in unsupported versions or forks.

## Safe harbor

We will not pursue or support legal action against researchers who act in **good faith**, follow this policy, avoid privacy violations and service disruption, and give us reasonable time to remediate before any public disclosure.

## After a fix ships

Patched releases are announced via GitHub Releases and the published advisory. Enable [Dependabot](https://docs.github.com/en/code-security/dependabot) on your fork to be notified automatically.

## Data handling — a note on privacy by design

MISTER is built to keep club data local. Fine-tuning, inference, and adapter distribution all happen on-device or over P2P. The web demo runs entirely in your browser; the only network calls it makes are to the QVAC inference backend (for the chat tab) and to fetch static assets from the repo. There is no analytics, no third-party tracker, and no cloud data store.

If you find a code path that leaks club data off-device unexpectedly, that qualifies as a security issue — please report it.

---

*Thank you for helping keep MISTER and its users safe.*
