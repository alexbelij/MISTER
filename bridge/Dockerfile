# MISTER QVAC Bridge — Hugging Face Space (Docker SDK)
#
# Runs a small Express server (bridge/server.js) that loads the repo's
# configured Qwen3-1.7B-Q4 model via @qvac/sdk (same wrapper used by the
# Electron app / src/inference/chat.js) and exposes /health and /chat over
# HTTP so the static demo/ web chat can call real on-device QVAC inference.
#
# HF Spaces Docker SDK expects the container to listen on port 7860.

FROM node:20-bookworm-slim

# Basic build tooling in case any native dep needs to compile (most @qvac/*
# packages ship prebuilt linux-x64 binaries, but keep this as a fallback).
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install deps first (better layer caching)
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund

# Copy the rest of the repo needed at runtime
COPY config ./config
COPY src ./src
COPY bridge ./bridge

# HF Spaces caches/downloads models under HOME; make sure it's writable.
ENV HOME=/app
ENV PORT=7860
RUN mkdir -p /app/logs && chmod -R 777 /app

EXPOSE 7860

CMD ["node", "bridge/server.js"]
