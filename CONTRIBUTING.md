# Contributing to MISTER

Thank you for thinking about contributing! MISTER is built to help coaches keep their tactical IP private, and community help — bug reports, ideas, code, docs — makes it stronger.

## Ways to contribute

- 🐛 **Report a bug** — open an issue with reproduction steps.
- 💡 **Propose a feature** — start a Discussion or open an issue tagged `enhancement`.
- 📝 **Improve docs** — the `README.md`, `JUDGE_GUIDE.md`, and inline JSDoc are all fair game.
- 🧩 **Ship code** — bug fixes, new QVAC integrations, new eval metrics, tactical modules.
- 🌐 **Translate** — the tactical translator supports 16+ languages; new locales welcome.
- 🎨 **Design** — UI polish, icons, better on-boarding.

## Before you open a PR

1. **Search open issues and PRs** — someone may already be on it.
2. **Open an issue first** for anything non-trivial. A 3-line problem statement + a proposed direction saves a lot of rework.
3. **Read the code style below** — small consistency wins.

## Local setup

```bash
# Clone the repo
git clone https://github.com/alexbelij/MISTER.git
cd MISTER

# Install (Node 20+)
npm install

# Run the desktop app in dev mode
npm run dev

# Serve the web demo locally
cd demo && python3 -m http.server 5173
# then open http://localhost:5173
```

## Development workflow

1. **Fork + branch** — one topic per branch (`fix/…`, `feat/…`, `docs/…`).
2. **Small commits** — each commit should tell a clear story.
3. **Match the surrounding style** — no linter fights; if you introduce one, wire it up and update `package.json`.
4. **Test what you can** — add or update tests under `tests/` when touching logic.
5. **Update docs** — if you change behaviour, update the relevant `.md`.
6. **Sign the PR description** — what changed, why, how you verified it.

## Code style

- **JavaScript** — modern (ES2022), single quotes, 2-space indent, semicolons required.
- **File names** — kebab-case for modules (`train-adapter.js`), PascalCase for React components.
- **Comments** — write *why*, not *what*. JSDoc for exported functions.
- **Errors** — always surface a meaningful message; never swallow and continue silently in code that runs against the user's data.
- **Never log secrets, tokens, or private keys.**

## Commit messages

We prefer conventional commits:

- `feat(area): short summary`
- `fix(area): short summary`
- `docs(area): …`, `refactor(area): …`, `test(area): …`, `chore(area): …`

Where `area` is e.g. `qvac`, `pears`, `demo`, `eval`, `ui`, `docs`.

## Reporting a bug

Please include:

1. What you were doing.
2. What you expected to happen.
3. What actually happened.
4. Your platform (macOS / Linux / Windows), Node version, whether you're on the desktop app, mobile Pear app, or web demo.
5. Relevant logs (with any personal data redacted).

## Security issues

**Do not open a public issue for a security problem.** Follow the process in [`SECURITY.md`](SECURITY.md).

## Code of conduct

Participation is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). Be excellent to each other — this is a community for people who care about coaching and about privacy-first AI.

## Licensing

By contributing, you agree that your contributions will be licensed under the MIT License, same as the rest of the project.

---

*Thanks again — every contribution helps.*
