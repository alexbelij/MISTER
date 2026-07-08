# MISTER QVAC Bridge

A small Express server that exposes real, on-device QVAC inference over HTTP
so the static `demo/` web chat can call a genuinely live backend instead of
its previous canned/keyword-matched responses.

It reuses the existing model-loading + completion logic in
`src/utils/qvac_wrapper.js` (the same wrapper the Electron app and
`src/inference/chat.js` use) — no QVAC calls are reimplemented here.

## Endpoints

- `GET /health` — liveness + model load status (`{ status, modelReady, modelLoading, modelError }`)
- `POST /chat` — `{ "message": "<string>" }` -> `{ "reply": "<string>" }`

## Deployment

Deployed as a Hugging Face Space (Docker SDK, free "CPU basic" hardware):

**https://huggingface.co/spaces/khrol/mister-qvac-bridge**
**Public API base URL: https://khrol-mister-qvac-bridge.hf.space**

The Space's own git repo contains a minimal copy of `package.json`,
`config/default.json`, `src/utils/{qvac_wrapper,config,logger,helpers}.js`,
and `bridge/server.js`, built with the `Dockerfile` in this directory
(the Space's Dockerfile lives at the root of the Space repo — see
`bridge/Dockerfile` here for the source of truth, kept in sync manually).

No secrets are required at runtime; the model is downloaded on demand by
`@qvac/sdk` at container startup from the `registry://` URL configured in
`config/default.json` (`model.llm` / `model.llmCatalogName`).

Because this runs on HF's free CPU tier, the Space can go to sleep after
inactivity and the model has to (re)load on wake, so the first request
after a period of inactivity can take from tens of seconds up to a couple
of minutes. `demo/app.js` handles this with a retry + loading state.

## Local dev

```
npm install
node bridge/server.js   # listens on PORT (default 7860)
curl localhost:7860/health
curl -X POST localhost:7860/chat -H 'content-type: application/json' -d '{"message":"What is our game plan vs a diamond midfield?"}'
```
