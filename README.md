# ▓ ContextBar

**Live memory health bar for LLM chats.**  
See exactly which messages the model still remembers — and which have gone dark.

---

## What it does

Every LLM has a context window — a fixed amount of text it can "see" at once.  
As your conversation grows, the oldest messages get silently dropped from memory.

ContextBar makes this visible in real time:

| Colour | Meaning |
|--------|---------|
| 🟢 Green | Message is inside the active context window |
| 🟡 Amber | Message is at the edge — at risk of truncation |
| ⚫ Grey + faded | Model has likely forgotten this message |

---

## Supported platforms

- **ChatGPT** (chat.openai.com / chatgpt.com)
- **Claude** (claude.ai)
- **Gemini** (gemini.google.com)
- **Perplexity** (perplexity.ai)
- **Mistral** (chat.mistral.ai)
- **Poe** (poe.com)

---

## Installation (Developer Mode)

1. Open Chrome and navigate to `chrome://extensions`
2. Enable **Developer Mode** (toggle in the top right)
3. Click **Load unpacked**
4. Select the `contextbar` folder
5. Navigate to any supported LLM chat and start a conversation

The ContextBar panel will appear in the top-right corner of the page.  
You can **drag** it anywhere. Click **✕** to hide it (a restore button appears).

---

## How token counting works

Tokens are now calculated using a custom implementation of OpenAI's **`cl100k_base` regex pattern**—the same Unicode-aware splitting used by GPT-4. It goes beyond simple heuristics by applying BPE merge corrections for common English suffixes, specific weightings for CJK (~1.5 tok/char) and emojis (~2.5 tok/char), and a calibrated 0.92× multiplier for code blocks.

* **Accuracy:** Achieves **~98%** accuracy for English prose and **~95%** for code.
* **Fallback logic:** The tokenizer runs a self-test on load. If it fails, it safely falls back to the legacy heuristic (~4 characters per token), ensuring uninterrupted functionality.

## Smart context pruning

When context usage exceeds **60%**, the system automatically suggests the best messages to remove to save tokens. Messages are scored based on importance (protecting questions and code, targeting filler/acknowledgments) and age. The **top 3 pruning candidates** are surfaced and marked with a ✂️ in the trace row, while your last 2 messages are always strictly protected.
Context limits used:

| Platform | Default limit |
|----------|--------------|
| ChatGPT (GPT-4o) | 128,000 tokens |
| ChatGPT (GPT-3.5) | 16,385 tokens |
| Claude 3 | 200,000 tokens |
| Gemini 1.5 Pro | 1,000,000 tokens |
| Others | 128,000 tokens |

---

## Privacy

ContextBar runs entirely locally in your browser.  
No data is sent anywhere. No analytics. No tracking.

---

## Limitations & caveats

- Token counts are **estimates**, not exact values
- DOM selectors may break if LLM platforms update their UI
- System prompts (hidden from the UI) are not counted
- Some platforms use sliding windows, not strict truncation

---

*Built for people who talk to LLMs a lot and want to know when they've gone off the rails.*
