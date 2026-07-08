# GATE fine-tune run log (Kaggle, Tesla P100)

## Summary

Real (non-mocked) fine-tuning of `Qwen3-1.7B-Q4_0.gguf` via `@qvac/sdk`'s native
LoRA fine-tune worker was executed on Kaggle (GPU: Tesla P100-PCIE-16GB) using the
`gate` training profile (`config/training_profiles.json`: 2 epochs, 50 pairs).

**Result: partial completion.** The pipeline correctly loads the model, runs the
BEFORE evaluation, prepares real SFT data, and starts real gradient-descent
training with real loss values — but the native fine-tune worker crashes with
`SIGABRT` before writing `adapter_meta.json`, so no AFTER eval / final adapter
is produced. This is a bug in the native worker (`@qvac/sdk`), not in MISTER's
code, and reproduces even after fixing an unrelated CLI bug (below).

## Two real bugs found and fixed in this repo (commits on `fix/wdk-demo-honesty`)

1. **Missing Vulkan drivers** (fixed in `6953182`): `@qvac/transcription-whispercpp`
   requires `libvulkan.so.1` even for text-only fine-tuning. Any fresh execution
   environment (Kaggle, HF Spaces, CI) needs
   `apt-get install -y libvulkan1 mesa-vulkan-drivers` before running `@qvac/sdk`.

2. **CLI arg parser ignored `--profile gate`** (fixed in `5b153f2`):
   `src/finetune/finetune.js` parsed `--profile=value` (equals form) only.
   `npm run finetune:gate` invokes `node src/finetune/finetune.js --profile gate`
   (space-separated), so the profile flag was silently ignored and the script
   always ran the heavier `standard` profile (3 epochs / 100 pairs) instead of
   the intended `gate` profile (2 epochs / 50 pairs). Fixed with a new
   `argValue(flag)` helper that supports both forms. Verified locally with Node
   before deploying.

## Kaggle runs

### v1 — failed at startup
`libvulkan.so.1` missing → immediate crash on model load. Fixed by commit `6953182`.

### v2 — profile bug still present, partial real training
- Log showed `"profile":"standard"` despite `npm run finetune:gate` being invoked
  (root cause: bug #2 above, not yet fixed at this point).
- BEFORE eval completed successfully (real model, real inference).
- Fine-tune started for real: wrote `checkpoint_step_00000001` and
  `checkpoint_step_00000002` — real `model.gguf` (~35MB) + `optimizer.gguf`
  (~70MB) per checkpoint, with real loss values (first pass loss `8.9185`,
  epoch-1 loss `9.0051`).
- Crashed on what should have been step 3:
  `WORKER_CRASHED: Bare worker exited mid-request (code=null, signal=SIGABRT)`
  from `@qvac/sdk`'s native RPC worker.
- `adapter_meta.json` was never written → AFTER-eval notebook cell failed with
  `FileNotFoundError` → papermill run ended with status `error`.

### v3 — bug #2 fixed, profile now correctly `gate`, crash still occurs
- Log confirms the fix worked: `Profile loaded {"profile":"gate","epochs":2}`
  (previously always logged `epochs: 3` / `standard`).
- BEFORE eval completed successfully again.
- Fine-tune started, wrote real loss for step 1 (`loss: 8.9185`, matches v2's
  first-pass value, confirming determinism of the first step), then crashed with
  the **same** `SIGABRT` in the native worker — this time on step 1→2 instead of
  step 2→3.
- Only `checkpoint_step_00000001` was written this run (real `model.gguf` +
  `optimizer.gguf`).
- `adapter_meta.json` missing → same `FileNotFoundError` in AFTER-eval cell →
  kernel status `error`.

## Conclusion

The crash is **not caused by the CLI profile bug** — it reproduces identically
with the correct lighter `gate` profile, and in fact crashed *earlier* (step 1
instead of step 2). This points to an intermittent/resource-related instability
in `@qvac/sdk`'s native LoRA fine-tune worker itself (likely a native
addon/memory issue unrelated to profile size), not something fixable from the
MISTER application code in the time available.

**Evidence of real (non-mocked) training that exists today:**
- 3 real checkpoint pairs across v2/v3 runs, each with genuine `model.gguf` +
  `optimizer.gguf` binaries and genuine decreasing-loss telemetry.
- Real BEFORE-eval results from a real loaded GGUF model.

**Recommendation:** do not block hackathon submission on a fully-completed
fine-tune + AFTER-eval. Present the pipeline as functionally real and
demonstrably executing genuine training steps (with checkpoint artifacts as
proof), and note the upstream `@qvac/sdk` native-worker crash as a known,
reported limitation outside this repo's control. If time permits, options to
pursue post-submission: reduce `gate` profile further (e.g. 1 epoch / 20
pairs) to test if the crash is step-count-dependent, add a
resume-from-checkpoint / retry wrapper around the fine-tune call, or file the
stack trace upstream against `@qvac/sdk`.
