# MISTER v5 — Master TODO & Implementation Plan

## 🎯 Цель: Гран-при Tether Developers Cup (5 000 USDt) + приз QVAC-трека (1 000 USDt)

### Дедлайны (GMT-7 → UTC+3 Минск)
- **8 июля 23:59 GMT-7 = 9 июля 09:59 Минск** — топ-16 (GitHub + demo ≤3 мин)
- **12 июля** — топ-4
- **14 июля 23:59 GMT-7 = 15 июля 09:59 Минск** — финальный билд
- **15–18 июля** — живые питчи
- **19 июля** — победители

### Треки
- **Основной:** QVAC (Local AI) — on-device LoRA fine-tuning
- **Дополнительный:** Pears (P2P) — adapter distribution + collaborative game model
- **Опциональный (пост-MVP):** WDK — adapter marketplace

---

## 📊 Текущий статус (v4)

| Метрика | Значение |
|---|---|
| Файлов | 38 |
| Строк JS | 5 728 |
| QVAC API вызовов | 30 (28 реальных, 2 фейковых) |
| SFT пар | 67 |
| Causal документов | 14 |
| Hold-out вопросов | 10 |
| Киллер-фич | 18 |

### 🔴 Критические проблемы v4
1. **API параметры неправильные** — `completion()` ждёт `modelId` + `history`, не `model` + `messages`; возвращает `CompletionRun` с `.events` и `.final`, не `.text`
2. **`loadModel()` параметры** — нужен `modelSrc: "model.gguf"` + `modelType: "llamacpp-completion"`, не вложенный `modelConfig.llm`
3. **`vla()` — для робототехники**, не для описания изображений. Нужно `completion()` с VLM-моделью
4. **`video()` — генерация видео**, не анализ. Убрать
5. **`classify()` — только 3 лейбла** (food/report/other), кастомные не принимаются
6. **`translate()` возвращает `{ text: Promise }`** — нужно `await result.text`
7. **`ocr()` возвращает `{ blocks: Promise }`** — нужно `await result.blocks`
8. **`textToSpeech()` возвращает `{ buffer: Promise<number[]> }`** — PCM samples, не WAV
9. **Нет мобильного приложения** — только Electron desktop
10. **Нет шифрования** — данные клуба хранятся открытым текстом
11. **UI — частично симулированный** — `window.mister` не вызывается
12. **`@qvac/sdk` не установлен** — невозможно тестировать

---

## 📋 ПОЛНЫЙ TODO ПЛАН

### ФАЗА 1: КРИТИЧНО — Исправить API параметры (Приоритет 0)

#### 1.1 Создать `src/utils/qvac_wrapper.js` — единая обёртка над QVAC SDK
- [ ] Функция `loadLLM(modelName, opts)` → правильный `loadModel({ modelSrc, modelType: "llamacpp-completion", modelConfig: { ctx_size } })`
- [ ] Функция `loadVLM(modelName, opts)` → `loadModel({ modelSrc, modelType: "llamacpp-vlm" })` (или completion с VLM)
- [ ] Функция `loadTTS(opts)` → `loadModel({ modelSrc, modelType: "tts" })`
- [ ] Функция `loadNMT(opts)` → `loadModel({ modelSrc, modelType: "nmt" })`
- [ ] Функция `loadWhisper(opts)` → `loadModel({ modelSrc, modelType: "whisper" })`
- [ ] Функция `loadEmbedder(opts)` → `loadModel({ modelSrc, modelType: "embedding" })`
- [ ] Функция `loadDiffusion(opts)` → `loadModel({ modelSrc, modelType: "diffusion", modelConfig: { mode: "upscale" } })`
- [ ] Функция `chat(modelId, messages, opts)` → `completion({ modelId, history })` → `await run.final` → `.content`
- [ ] Функция `chatStream(modelId, messages, onToken)` → `for await (event of run.events)` → `event.type === "contentDelta"`
- [ ] Функция `embed(text)` → `embed({ text })` → правильный возврат вектора
- [ ] Функция `tts(text, opts)` → `textToSpeech({ text })` → `await result.buffer` → PCM → WAV конвертация
- [ ] Функция `ttsStream(text, onChunk)` → `textToSpeechStream` → `for await (chunk of result.bufferStream)`
- [ ] Функция `stt(audioBuffer, opts)` → `transcribe({ audio })` → `await result.text`
- [ ] Функция `sttStream(onText)` → `transcribeStream` → streaming
- [ ] Функция `translateText(text, targetLang, opts)` → `translate({ text, targetLang })` → `await result.text`
- [ ] Функция `translateStream(text, targetLang, onToken)` → `result.tokenStream`
- [ ] Функция `ocrImage(imageBuffer, opts)` → `ocr({ image })` → `await result.blocks` → `blocks.map(b => b.text).join("")`
- [ ] Функция `describeImage(modelId, imageBuffer, prompt)` → `completion({ modelId, history: [{ role: "user", content: [{ type: "image", ... }, { type: "text", text: prompt }] }] })` (VLM через completion)
- [ ] Функция `upscaleImage(imageBuffer, scale)` → `loadModel({ modelType: "diffusion", mode: "upscale" })` → `upscale({ image, scale })` → `await result.outputs[0]`
- [ ] Функция `ragIngest(workspace, docs)` → правильные параметры `ragIngest({ workspace, documents })`
- [ ] Функция `ragSearch(workspace, query, topK)` → `ragSearch({ workspace, query, topK })` → правильный возврат
- [ ] Функция `ragList()` → `ragListWorkspaces({})`
- [ ] Функция `ragClose(workspace)` → `ragCloseWorkspace({ workspace })`
- [ ] Функция `finetuneRun(modelId, params, onProgress)` → `finetune({ model: modelId, ...params })` → `handle.progressStream` + `await handle.result`
- [ ] Функция `finetuneState(jobId)` → `finetune({ action: "state", jobId })`
- [ ] Функция `finetuneSuspend(jobId)` → `finetune({ action: "suspend", jobId })`
- [ ] Функция `finetuneResume(jobId)` → `finetune({ action: "resume", jobId })`
- [ ] Функция `finetuneCancel(jobId)` → `finetune({ action: "cancel", jobId })`
- [ ] Функция `modelInfo(modelId)` → `getLoadedModelInfo({ modelId })`
- [ ] Функция `catalogInfo(modelName)` → `getModelInfo({ model })`
- [ ] Функция `unload(modelId)` → `unloadModel({ modelId })`
- [ ] Функция `registrySearch(opts)` → `modelRegistrySearch(opts)`
- [ ] Функция `registryList()` → `modelRegistryList({})`
- [ ] Функция `pcmToWav(pcmData, sampleRate)` → конвертация PCM number[] → WAV Buffer
- [ ] Функция `healthCheck()` → `heartbeat({})` → проверка что QVAC провайдер запущен

#### 1.2 Обновить все модули использовать `qvac_wrapper.js`
- [ ] `finetune.js` → использовать `loadLLM()`, `finetuneRun()`, `modelInfo()`, `unload()`
- [ ] `chat.js` → использовать `loadLLM()`, `chat()`, `ragSearch()`
- [ ] `rag_engine.js` → использовать `ragIngest()`, `ragSearch()`, `embed()`
- [ ] `eval_harness.js` → использовать `loadLLM()`, `chat()`, `embed()`
- [ ] `enhanced_eval.js` → использовать `loadLLM()`, `chat()`, `embed()`
- [ ] `briefing.js` → использовать `loadLLM()`, `chat()`, `tts()`, `ttsStream()`
- [ ] `input.js` → использовать `loadWhisper()`, `stt()`, `sttStream()`
- [ ] `footage.js` → использовать `loadVLM()`, `describeImage()`, `upscaleImage()`, `loadLLM()`, `chat()`
- [ ] `notes.js` (OCR) → использовать `ocrImage()`, `describeImage()` (fallback)
- [ ] `translate.js` → использовать `loadNMT()`, `translateText()`, `translateStream()`
- [ ] `delegate.js` → использовать `loadLLM()`, `chat()`
- [ ] `multi_agent.js` → использовать `loadLLM()`, `chat()`
- [ ] `select.js` (registry) → использовать `registrySearch()`, `registryList()`, `catalogInfo()`

#### 1.3 Убрать фейковые API
- [ ] Убрать `qvac.inference.serve/connect` из `delegate.js` → Hyperswarm + `chat()`
- [ ] Убрать `qvac.vlm.completion` из `footage.js` → `describeImage()` через `completion()`
- [ ] Убрать `qvac.video()` из `footage.js` → это генерация, не анализ
- [ ] Убрать кастомные категории из `classify()` → использовать только для food/report/other или убрать

---

### ФАЗА 2: Мобильное приложение (Pear app) — Киллер-фича для жюри

#### 2.1 Создать Pear app структуру
- [ ] `pear.json` — конфигурация Pear app
- [ ] `mobile/index.html` — мобильный UI (React/React Native через Pear)
- [ ] `mobile/styles.css` — мобильные стили (touch-friendly, dark mode)
- [ ] `mobile/app.js` — мобильная логика
- [ ] `mobile/worker.js` — Pear worker для QVAC SDK (не main thread)

#### 2.2 Мобильные киллер-фичи
- [ ] **Камера → OCR → Training**: фотка рукописных заметок → `ocrImage()` → структурированный текст → `ragIngest()` + SFT pairs
- [ ] **Камера → VLM Analysis**: фотка кадра матча → `describeImage()` → тактический разбор через club brain
- [ ] **QR-обмен адаптерами**: генерация QR с P2P topic key → скан → загрузка адаптера
- [ ] **Голосовой ввод**: `sttStream()` → чат с клубным мозгом hands-free
- [ ] **Голосовая установка**: `ttsStream()` → spoken match briefing
- [ ] **Офлайн-кеш**: все данные локально, работает без сети
- [ ] **P2P-делегирование**: телефон → ноут (Hyperswarm) для тяжёлого файнтюна
- [ ] **Многоязычность**: `translateText()` для легионеров (16+ языков)

#### 2.3 Мобильный UI
- [ ] Bottom tab navigation: Chat / Camera / Voice / Settings
- [ ] Chat: сообщения + RAG info + время ответа
- [ ] Camera: фотка → выбор режима (OCR / VLM analysis) → результат
- [ ] Voice: кнопка записи → STT → отправка в чат → TTS ответ
- [ ] Settings: модель, квантизация, RAG workspace, адаптер, P2P
- [ ] Pull-to-refresh для чата
- [ ] Dark mode (по умолчанию)
- [ ] Touch-friendly кнопки (минимум 44px)

---

### ФАЗА 3: Шифрование и безопасность

#### 3.1 Создать `src/security/crypto.js`
- [ ] `encryptData(data, password)` → AES-256-GCM
- [ ] `decryptData(encrypted, password)` → AES-256-GCM
- [ ] `deriveKey(password, salt)` → PBKDF2 (100k iterations)
- [ ] `hashData(data)` → SHA-256
- [ ] `generateSalt()` → crypto.randomBytes(32)
- [ ] `encryptFile(filePath, password)` → шифрование файла at-rest
- [ ] `decryptFile(filePath, password)` → расшифровка

#### 3.2 Защита данных клуба
- [ ] Шифровать `club_profile.json`, `sft_pairs.json`, `causal_corpus.json` at-rest
- [ ] Шифровать адаптер `.gguf` при передаче через Pears
- [ ] Парольная фраза для доступа к данным клуба
- [ ] Auto-lock после 5 минут неактивности
- [ ] Secure delete (overwrite + delete)

#### 3.3 Compliance
- [ ] **GDPR (ЕС)**: Privacy policy, right to erasure, data export, data minimization
- [ ] **CCPA (США)**: Right to know, right to delete, right to opt-out
- [ ] **APPI (Япония)**: Local storage notification, consent
- [ ] **PDP (Южная Корея)**: Consent for data processing
- [ ] **PDPA (Сингапур)**: Data protection notification
- [ ] `PRIVACY.md` — политика конфиденциальности
- [ ] `COMPLIANCE.md` — соответствие нормам
- [ ] UI: "Delete all club data" кнопка
- [ ] UI: "Export all data" кнопка
- [ ] Audit log: кто обращался к данным, когда

---

### ФАЗА 4: Глубокая интеграция всех технологий спонсоров

#### 4.1 QVAC — максимум API (49 функций, используем 30+)

| API | Файл | Киллер-фича |
|---|---|---|
| `loadModel` | Все | Загрузка LLM/VLM/TTS/NMT/Whisper/Embedder/Diffusion |
| `completion` | chat, eval, footage | Чат с клубным мозгом (streaming) |
| `finetune` | finetune.js | On-device LoRA — флагман |
| `embed` | rag_engine, eval | Семантический поиск + cosine similarity eval |
| `ragIngest` | rag_engine | Загрузка клубных документов в векторную БД |
| `ragSearch` | chat, multi_agent | Семантический поиск по клубным данным |
| `ragListWorkspaces` | rag_engine | Управление workspace |
| `ragCloseWorkspace` | rag_engine | Очистка |
| `ragDeleteWorkspace` | rag_engine | GDPR right to erasure |
| `textToSpeech` | briefing | Голосовая установка тренеру |
| `textToSpeechStream` | briefing, mobile | Streaming TTS — голос в реальном времени |
| `transcribe` | input | Голосовой ввод вопросов |
| `transcribeStream` | input, mobile | Live transcription — hands-free |
| `translate` | translate | Установка на 16+ языков для легионеров |
| `ocr` | notes | OCR рукописных заметок тренера — уникальная фича |
| `vla` | notes (fallback) | Fallback для OCR через VLM |
| `upscale` | footage | Улучшение качества кадров перед анализом |
| `classify` | footage | Базовая классификация (food/report/other) |
| `getModelInfo` | finetune, registry | Информация о модели из каталога |
| `getLoadedModelInfo` | finetune | Информация о загруженной модели (memory, handlers) |
| `unloadModel` | Все | Управление памятью — выгрузка после использования |
| `modelRegistrySearch` | select.js | Выбор модели под железо пользователя |
| `modelRegistryList` | select.js | Список всех доступных моделей |
| `state` | finetune | Статус файнтюна (running/paused/done) |
| `suspend` | finetune | Пауза файнтюна |
| `resume` | finetune | Возобновление файнтюна |
| `cancel` | finetune | Отмена файнтюна |
| `heartbeat` | qvac_wrapper | Health check — QVAC провайдер запущен? |
| `diffusion` | (future) | Генерация тактических диаграмм (пост-MVP) |
| `ragChunk` | rag_engine | Явный чанкинг документов |
| `ragSaveEmbeddings` | rag_engine | Кеширование эмбеддингов |
| `ragDeleteEmbeddings` | rag_engine | GDPR right to erasure |
| `ragReindex` | rag_engine | Переиндексация после обновления данных |
| `downloadAsset` | qvac_wrapper | Скачивание моделей |
| `deleteCache` | qvac_wrapper | Очистка кеша моделей |
| `subscribeServerLogs` | qvac_wrapper | Логирование QVAC сервера |
| `loggingStream` | qvac_wrapper | Streaming логов |
| `startQVACProvider` | qvac_wrapper | Автозапуск QVAC провайдера |
| `stopQVACProvider` | qvac_wrapper | Остановка провайдера |

#### 4.2 Pears — максимум genuine использования

| Компонент | Файл | Использование |
|---|---|---|
| Hyperswarm | delegate.js, distribute.js | P2P inference delegation + adapter distribution |
| Hyperblobs | distribute.js | Передача адаптера (binary blob) |
| Hypercore | collab_model.js | Tamper-evident history (game model log) |
| Autobase | collab_model.js | Multi-writer collaborative game model |
| Corestore | collab_model.js, distribute.js | Локальное хранилище Pears |
| pear-runtime | mobile app | Pear app для мобильных (iOS/Android) |
| Bare worker | mobile/worker.js | QVAC SDK в Pear worker (не main thread) |

#### 4.3 WDK — marketplace (пост-MVP, к 12 июля)

| Компонент | Файл | Использование |
|---|---|---|
| `@tetherto/wdk` | marketplace.js | Self-custody wallet |
| ERC-4337 | marketplace.js | Smart account для M-of-N |
| Paymaster | marketplace.js | Gasless USDt transfers |
| `pear-wrk-wdk` | marketplace.js | WDK в Pear worker |
| UI Kit | mobile app | React Native wallet UI |

---

### ФАЗА 5: Уникальные киллер-фичи (для Гран-при)

#### 5.1 Уже есть (нужно довести до рабочего состояния)
1. **On-device LoRA fine-tuning** — никто в поле не делает
2. **OCR рукописных заметок** → SFT pairs → training pipeline
3. **Tactical Translator** — 16+ языков для легионеров
4. **Eval harness** — 3-layer (lexical + embedding + LLM judge)
5. **Collaborative game model** — Pears Autobase multi-writer
6. **P2P inference delegation** — телефон → ноут
7. **Voice briefing** — TTS streaming
8. **Voice input** — STT streaming
9. **Footage analysis** — VLM через completion
10. **Model registry** — выбор под железо
11. **Player ratings** — game-model-based критерии
12. **Opponent tracker** — pattern analysis
13. **Data augmentation** — парафразы, сценарии, терминология
14. **Multi-agent fallback** — 4 агента с роутингом
15. **Adapter marketplace** — gasless USDt (пост-MVP)

#### 5.2 Новые киллер-фичи для v5
16. **Mobile Pear app** — камера, QR, голос, офлайн
17. **QR adapter exchange** — мгновенный обмен через QR-код
18. **Encryption at-rest** — AES-256 для данных клуба
19. **GDPR/CCPA compliance** — delete/export data UI
20. **Finetune management** — pause/resume/cancel из UI
21. **Streaming chat** — токены в реальном времени (`completion().events`)
22. **Health check** — `heartbeat()` для проверки QVAC провайдера
23. **Auto model selection** — `modelRegistrySearch()` под железо
24. **PCM → WAV conversion** — правильный TTS output
25. **Tactical diagram generation** (пост-MVP) — `diffusion()` для тактических схем

---

### ФАЗА 6: UI — реальный Electron IPC + мобильный

#### 6.1 Desktop UI (Electron)
- [ ] `window.mister` bridge — реальные IPC вызовы
- [ ] Training: реальный progress stream из `finetune.js`
- [ ] Chat: реальный `chat()` → streaming tokens
- [ ] Eval: реальные результаты из `eval_harness.js`
- [ ] Voice: реальные `tts()` / `stt()` вызовы
- [ ] Analysis: реальный `describeImage()` / `ocrImage()`
- [ ] Distribution: реальный `distribute.js` spawn
- [ ] Settings: модель, квантизация, RAG, шифрование

#### 6.2 Mobile UI (Pear app)
- [ ] Bottom tabs: Chat / Camera / Voice / Settings
- [ ] Chat: streaming tokens, RAG info
- [ ] Camera: OCR / VLM analysis modes
- [ ] Voice: STT → chat → TTS
- [ ] QR: generate / scan adapter exchange
- [ ] Settings: model, quantization, encryption, P2P
- [ ] Offline indicator
- [ ] Touch-friendly (44px min buttons)

---

### ФАЗА 7: Данные и пайплайн

#### 7.1 Расширить датасет
- [ ] 100+ SFT пар (сейчас 67)
- [ ] 20+ causal документов (сейчас 14)
- [ ] 15+ hold-out вопросов (сейчас 10)
- [ ] 5+ соперников (сейчас 3)
- [ ] Тренировочные сессии (3+)
- [ ] Профили игроков с детальной статистикой

#### 7.2 Data pipeline интеграция
- [ ] OCR → SFT pairs → augment → prepare → finetune (автоматический pipeline)
- [ ] Player ratings → SFT pairs (оценки → training data)
- [ ] Opponent tracker → RAG ingest (обновление RAG после матча)
- [ ] Collab model → causal corpus (наблюдения → training data)
- [ ] Augmentation → automatic перед finetune

---

### ФАЗА 8: Документация и evidence-bundle

#### 8.1 Документы
- [ ] `README.md` — обновить с реальными API + мобильным app
- [ ] `JUDGE_GUIDE.md` — обновить с новыми киллер-фичами
- [ ] `DEMO_SCRIPT.md` — обновить с мобильным демо
- [ ] `PRIVACY.md` — политика конфиденциальности
- [ ] `COMPLIANCE.md` — GDPR/CCPA/APPI/PDPA соответствие
- [ ] `ARCHITECTURE.md` — диаграмма архитектуры
- [ ] `API_REFERENCE.md` — список всех QVAC API использованных
- [ ] `MOBILE_GUIDE.md` — инструкция для мобильного app

#### 8.2 Evidence-bundle для жюри
- [ ] Eval delta table (BEFORE/AFTER)
- [ ] Training logs (loss curves)
- [ ] Checkpoints
- [ ] Screenshot mobile app
- [ ] Screenshot desktop app
- [ ] Screenshot eval panel
- [ ] Screenshot OCR pipeline
- [ ] Screenshot voice briefing
- [ ] Screenshot P2P distribution
- [ ] QR code for adapter exchange

#### 8.3 Demo video (≤3 мин)
- [ ] 0:00-0:15 Hook: "MISTER — club brain that fine-tunes on your data"
- [ ] 0:15-0:30 Mobile: фотка рукописных заметок → OCR → текст
- [ ] 0:30-1:00 Desktop: "Train Club Brain" → progress → adapter ready
- [ ] 1:00-1:30 Eval: BEFORE/AFTER delta table → GO verdict
- [ ] 1:30-2:00 Chat: "Plan vs Hafen" → streaming response in club voice
- [ ] 2:00-2:20 Mobile: voice question → STT → chat → TTS response
- [ ] 2:20-2:40 QR: generate → scan → adapter on second device
- [ ] 2:40-2:50 Translate: briefing → Portuguese for legionário
- [ ] 2:50-3:00 Close: "On-device LoRA, P2P distribution, privacy-first"

---

### ФАЗА 9: Тестирование

#### 9.1 Unit tests
- [ ] Test `qvac_wrapper.js` — все функции
- [ ] Test `crypto.js` — шифрование/расшифровка
- [ ] Test `helpers.js` — text processing, stats
- [ ] Test data validation — SFT pairs, club profile
- [ ] Test config loader — profiles, env overrides

#### 9.2 Integration tests
- [ ] Test full pipeline: prepare → finetune → eval
- [ ] Test RAG: ingest → search
- [ ] Test P2P: distribute → receive
- [ ] Test OCR: image → text → SFT
- [ ] Test voice: STT → chat → TTS

#### 9.3 E2E tests
- [ ] Desktop: load data → train → eval → chat → distribute
- [ ] Mobile: camera → OCR → chat → voice → QR

---

## 🏗️ ПЛАН РЕАЛИЗАЦИИ (порядок работ)

### Цикл 1: КРИТИЧНО — API Wrapper (сейчас)
1. `src/utils/qvac_wrapper.js` — единая обёртка (40+ функций)
2. Обновить `finetune.js` — правильные параметры
3. Обновить `chat.js` — streaming completion
4. Обновить `rag_engine.js` — реальные RAG API
5. Обновить `eval_harness.js` + `enhanced_eval.js` — embedding eval

### Цикл 2: Voice + OCR + Translate (правильные API)
6. Обновить `briefing.js` — textToSpeech + PCM→WAV
7. Обновить `input.js` — transcribe + transcribeStream
8. Обновить `notes.js` — ocr + blocks
9. Обновить `translate.js` — translate + await result.text
10. Обновить `footage.js` — describeImage через completion

### Цикл 3: Безопасность
11. `src/security/crypto.js` — AES-256 шифрование
12. Шифрование данных клуба at-rest
13. `PRIVACY.md` + `COMPLIANCE.md`
14. UI: delete/export data

### Цикл 4: Мобильное приложение
15. `pear.json` + mobile структура
16. Mobile UI (chat/camera/voice/settings)
17. Camera → OCR → training pipeline
18. QR adapter exchange
19. Voice STT → chat → TTS на мобильном

### Цикл 5: UI — реальный IPC
20. Обновить `ui/index.html` — реальные IPC вызовы
21. Обновить `main.js` — все handlers spawn реальные процессы
22. Streaming chat в UI
23. Settings panel

### Цикл 6: Данные + пайплайн
24. Расширить SFT до 100+ пар
25. Расширить causal до 20+ документов
26. Интегрировать OCR → SFT → augment → finetune pipeline
27. Интегрировать player ratings → SFT
28. Интегрировать collab model → causal corpus

### Цикл 7: Документация + demo
29. Обновить README, JUDGE_GUIDE, DEMO_SCRIPT
30. Evidence-bundle
31. Demo video script
32. GitHub repo setup (MIT license, public commits)

---

## 📊 ОЖИДАЕМЫЙ РЕЗУЛЬТАТ v5

| Метрика | v4 | v5 (цель) |
|---|---|---|
| Файлов | 38 | 55+ |
| Строк кода | 5 728 | 8 000+ |
| QVAC API использовано | 30 | 38+ |
| Фейковых API | 2 | 0 |
| Киллер-фич | 18 | 25+ |
| Платформы | Desktop (Electron) | Desktop + Mobile (Pear) |
| Шифрование | Нет | AES-256 at-rest |
| Compliance | Нет | GDPR/CCPA/APPI/PDPA |
| Мобильные возможности | Нет | Камера/QR/NFC/голос |
| Streaming | Нет | Chat + TTS + STT |
| Real IPC | Частично | Полностью |

---

## ⚡ ЧТО Я МОГУ СДЕЛАТЬ СЕЙЧАС (максимум за цикл)

1. **`qvac_wrapper.js`** — единая обёртка над всеми QVAC API (40+ функций, правильные параметры)
2. **Обновить все модули** — использовать wrapper вместо прямых вызовов
3. **`crypto.js`** — шифрование AES-256
4. **Мобильный Pear app** — структура + UI + camera/QR/voice
5. **Расширить датасет** — 100+ SFT, 20+ causal
6. **Обновить UI** — реальные IPC вызовы
7. **Документация** — README, PRIVACY, COMPLIANCE

Начинаю с ФАЗЫ 1 (API wrapper) — это критично, без него ничего не запустится.
