(function () {
  'use strict';

  if (window.__contextBarInitialized) return;
  window.__contextBarInitialized = true;

  // ═══════════════════════════════════════════════════════════
  // PLATFORM CONFIGS
  // ═══════════════════════════════════════════════════════════

  const PLATFORMS = {
    'chat.openai.com': makeChatGPTConfig(),
    'chatgpt.com':     makeChatGPTConfig(),
    'claude.ai':       makeClaudeConfig(),
    'gemini.google.com': makeGeminiConfig(),
    'perplexity.ai':   makePerplexityConfig(),
    'chat.mistral.ai': makeMistralConfig(),
    'poe.com':         makePoeConfig(),
  };

  function makeChatGPTConfig() {
    return {
      name: 'ChatGPT', badge: 'GPT',
      getContextLimit() {
        const candidates = [
          document.querySelector('[data-testid="model-switcher-dropdown-button"]'),
          document.querySelector('button[aria-haspopup="listbox"]'),
          document.querySelector('button[aria-haspopup="menu"] span'),
          document.querySelector('[class*="model"] button'),
        ];
        for (const el of candidates) {
          if (!el) continue;
          const t = el.textContent.toLowerCase();
          if (t.includes('o3') || t.includes('o1')) return 128000;
          if (t.includes('4o') || t.includes('gpt-4')) return 128000;
          if (t.includes('3.5')) return 16385;
        }
        return 128000;
      },
      getMessages() {
        const msgs = [];

        // Strategy 1: modern — data-message-author-role attribute
        let els = document.querySelectorAll('[data-message-author-role]');

        // Strategy 2: article-based turns
        if (!els.length) {
          els = document.querySelectorAll('article[data-testid^="conversation-turn"]');
        }

        // Strategy 3: group turns
        if (!els.length) {
          els = document.querySelectorAll('.group\\/conversation-turn, [class*="ConversationTurn"]');
        }

        if (els.length) {
          els.forEach((el) => {
            const role = el.getAttribute('data-message-author-role') ||
              (el.querySelector('[data-message-author-role="user"]') ? 'user' : 'assistant');
            const contentEl =
              el.querySelector('[data-message-author-role] .markdown') ||
              el.querySelector('.markdown.prose') ||
              el.querySelector('[class*="prose"]') ||
              el.querySelector('.whitespace-pre-wrap') ||
              el.querySelector('[data-message-author-role]') ||
              el;
            const text = contentEl.innerText.trim();
            if (text && text.length > 1) msgs.push({ role, text, el });
          });
        }

        return msgs;
      },
    };
  }

  function makeClaudeConfig() {
    return {
      name: 'Claude', badge: 'CLD',
      getContextLimit() { return 200000; },
      getMessages() {
        const msgs = [];
        const allTurns = [];

        document.querySelectorAll('[data-testid="human-turn"]').forEach((el) => allTurns.push({ role: 'user', el }));
        document.querySelectorAll('[data-testid="ai-turn"]').forEach((el) => allTurns.push({ role: 'assistant', el }));

        if (!allTurns.length) {
          document.querySelectorAll('[class*="HumanTurn"], [class*="HumanMessage"]').forEach((el) => allTurns.push({ role: 'user', el }));
          document.querySelectorAll('[class*="AITurn"], [class*="AssistantMessage"]').forEach((el) => allTurns.push({ role: 'assistant', el }));
        }

        if (!allTurns.length) {
          document.querySelectorAll('.font-user-message, .font-claude-message').forEach((el) => {
            allTurns.push({ role: el.classList.contains('font-user-message') ? 'user' : 'assistant', el });
          });
        }

        allTurns.sort((a, b) =>
          a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
        );
        allTurns.forEach(({ role, el }) => {
          const text = el.innerText.trim();
          if (text && text.length > 1) msgs.push({ role, text, el });
        });
        return msgs;
      },
    };
  }

  function makeGeminiConfig() {
    return {
      name: 'Gemini', badge: 'GEM',
      getContextLimit() { return 1000000; },
      getMessages() {
        const msgs = [];
        document.querySelectorAll('user-query').forEach((el) => {
          const text = el.innerText.trim();
          if (text) msgs.push({ role: 'user', text, el });
        });
        document.querySelectorAll('model-response').forEach((el) => {
          const text = el.innerText.trim();
          if (text) msgs.push({ role: 'assistant', text, el });
        });
        if (msgs.length) return msgs;
        document.querySelectorAll('.user-query-text-line, .user-query-container').forEach((el) => {
          const text = el.innerText.trim();
          if (text) msgs.push({ role: 'user', text, el });
        });
        document.querySelectorAll('.markdown-main-panel, .response-container-content').forEach((el) => {
          const text = el.innerText.trim();
          if (text) msgs.push({ role: 'assistant', text, el });
        });
        return msgs;
      },
    };
  }

  function makePerplexityConfig() {
    return {
      name: 'Perplexity', badge: 'PPX',
      getContextLimit: () => 128000,
      getMessages() {
        const msgs = [];
        document.querySelectorAll('[data-testid="user-message"]').forEach((el) => {
          const text = el.innerText.trim();
          if (text) msgs.push({ role: 'user', text, el });
        });
        document.querySelectorAll('[data-testid="answer"]').forEach((el) => {
          const text = el.innerText.trim();
          if (text) msgs.push({ role: 'assistant', text, el });
        });
        if (!msgs.length) {
          document.querySelectorAll('[class*="UserMessage"], [class*="AnswerMessage"]').forEach((el) => {
            const isUser = el.className.toLowerCase().includes('user');
            const text = el.innerText.trim();
            if (text) msgs.push({ role: isUser ? 'user' : 'assistant', text, el });
          });
        }
        return msgs;
      },
    };
  }

  function makeMistralConfig() {
    return {
      name: 'Mistral', badge: 'MST',
      getContextLimit: () => 128000,
      getMessages() {
        const msgs = [];
        document.querySelectorAll('[class*="UserMessage"], [class*="AssistantMessage"], [class*="BotMessage"]').forEach((el) => {
          const cls = el.className.toLowerCase();
          const text = el.innerText.trim();
          if (text) msgs.push({ role: cls.includes('user') ? 'user' : 'assistant', text, el });
        });
        return msgs;
      },
    };
  }

  function makePoeConfig() {
    return {
      name: 'Poe', badge: 'POE',
      getContextLimit: () => 128000,
      getMessages() {
        const msgs = [];
        document.querySelectorAll('[class*="humanMessageBubble"], [class*="botMessageBubble"], [class*="Message_humanMessage"], [class*="Message_botMessage"]').forEach((el) => {
          const isUser = el.className.includes('human') || el.className.includes('Human');
          const text = el.innerText.trim();
          if (text) msgs.push({ role: isUser ? 'user' : 'assistant', text, el });
        });
        return msgs;
      },
    };
  }

  // ═══════════════════════════════════════════════════════════
  // TOKENIZER
  // ═══════════════════════════════════════════════════════════

  function countTokens(text) {
    if (window.CB_TOKENIZER && window.CB_TOKENIZER.healthy) {
      try { return window.CB_TOKENIZER.count(text); } catch (_) {}
    }
    const codeBlocks = (text.match(/```[\s\S]*?```/g) || []);
    const codeLen = codeBlocks.reduce((s, b) => s + b.length, 0);
    const normalLen = text.length - codeLen;
    return Math.max(1, Math.round(normalLen / 4 + codeLen / 3.5));
  }

  // ═══════════════════════════════════════════════════════════
  // PRUNE ENGINE
  // ═══════════════════════════════════════════════════════════

  const FILLER_PAT = /^(ok|okay|got it|sure|thanks|thank you|sounds good|great|perfect|yes|no|alright|understood|makes sense|cool|nice|noted|i see|i understand|will do|go ahead|please|continue)[.!?]?$/i;
  const ACK_PAT = /^.{1,30}$/;

  function scoreImportance(msg) {
    const t = msg.text;
    const lower = t.toLowerCase().trim();
    if (msg.role === 'user' && t.includes('?')) return 0.85;
    if (FILLER_PAT.test(lower)) return 0.05;
    if (ACK_PAT.test(lower) && !t.includes('?')) return 0.1;
    if (/```/.test(t)) return 0.75;
    if (/https?:\/\//.test(t)) return 0.7;
    if (/^#+\s/m.test(t) || /^\d+\.\s/m.test(t)) return 0.65;
    if (msg.role === 'assistant' && msg.tokens > 300) return 0.55;
    if (msg.role === 'assistant' && msg.tokens < 80) return 0.3;
    return 0.45;
  }

  function pruneReason(msg, importance) {
    const t = msg.text.toLowerCase().trim();
    if (FILLER_PAT.test(t)) return 'filler message';
    if (ACK_PAT.test(t) && !t.includes('?')) return 'short acknowledgment';
    if (msg.role === 'assistant' && msg.tokens > 300 && importance < 0.65) return 'long response — consider summarising';
    if (msg.role === 'assistant' && msg.tokens < 80) return 'short reply, low info density';
    if (msg.role === 'user' && !msg.text.includes('?') && msg.tokens < 60) return 'short prompt, no question';
    return 'older message — low recency value';
  }

  function computePruneScores(messages, statusMap) {
    const total = messages.length;
    const candidates = [];
    for (let i = 0; i < total - 2; i++) {
      if (statusMap[i] !== 'green' && statusMap[i] !== 'amber') continue;
      const msg = messages[i];
      const importance = scoreImportance(msg);
      const score = (1 - importance) * 0.55 + (1 - i / total) * 0.3 + (msg.tokens / 2000) * 0.15;
      if (score > 0.35 && msg.tokens >= 30) {
        candidates.push({ index: i, msg, tokens: msg.tokens, importance, score, reason: pruneReason(msg, importance) });
      }
    }
    return candidates.sort((a, b) => b.tokens - a.tokens).slice(0, 3);
  }

  // ═══════════════════════════════════════════════════════════
  // DETECT PLATFORM
  // ═══════════════════════════════════════════════════════════

  const hostname = window.location.hostname;
  const platformKey = Object.keys(PLATFORMS).find((k) => hostname.includes(k));
  const platform = platformKey ? PLATFORMS[platformKey] : null;

  // ═══════════════════════════════════════════════════════════
  // CONTEXTBAR CLASS
  // ═══════════════════════════════════════════════════════════

  class ContextBar {
    constructor() {
      this.panel = null;
      this.restoreBtn = null;
      this.observer = null;
      this.updateTimer = null;
      this.retryTimer = null;
      this.retryCount = 0;
      this.isDragging = false;
      this.lastUrl = location.href;
      this.hasData = false;

      this.init();
    }

    init() {
      this.injectPanel();        // ← ALWAYS first, regardless of platform match
      this.bindEvents();
      this.startObserving();
      this.handleSPANavigation();

      // Progressive retry: 800ms, 2s, 4s, then every 3s for 2 min
      setTimeout(() => this.update(), 800);
      setTimeout(() => this.update(), 2000);
      setTimeout(() => this.update(), 4000);

      this.retryTimer = setInterval(() => {
        if (this.hasData) { clearInterval(this.retryTimer); return; }
        this.retryCount++;
        this.update();
        if (this.retryCount >= 40) clearInterval(this.retryTimer);
      }, 3000);
    }

    // ─────────────────────────────────────────
    // SPA NAVIGATION
    // ─────────────────────────────────────────

    handleSPANavigation() {
      const origPush = history.pushState.bind(history);
      history.pushState = (...args) => { origPush(...args); this.onNavigate(); };
      window.addEventListener('popstate', () => this.onNavigate());
    }

    onNavigate() {
      if (location.href === this.lastUrl) return;
      this.lastUrl = location.href;
      this.hasData = false;
      this.showWaiting();
      if (window.CB_HALLUCINATION) window.CB_HALLUCINATION.clearOverlays();
      setTimeout(() => this.update(), 1000);
      setTimeout(() => this.update(), 2500);
      setTimeout(() => this.update(), 5000);
    }

    // ─────────────────────────────────────────
    // WAITING STATE
    // ─────────────────────────────────────────

    showWaiting() {
      const trList = document.getElementById('cb-trace-list');
      if (trList && !this.hasData) {
        trList.innerHTML = `<div class="cb-trace-waiting">
          ${platform ? '↻ Waiting for messages…' : '⚠ Platform not recognised'}
        </div>`;
      }
      // Show limit even before messages appear
      if (platform) {
        try {
          const limEl = document.getElementById('cb-s-limit');
          if (limEl) limEl.textContent = fmtK(platform.getContextLimit());
        } catch (_) {}
      }
    }

    // ─────────────────────────────────────────
    // DOM CREATION — always injects the panel
    // ─────────────────────────────────────────

    injectPanel() {
      document.getElementById('cb-panel')?.remove();

      this.panel = document.createElement('div');
      this.panel.id = 'cb-panel';
      this.panel.setAttribute('role', 'complementary');
      this.panel.setAttribute('aria-label', 'ContextBar memory health');

      this.panel.innerHTML = `
        <div id="cb-drag-handle">
          <div id="cb-title-row">
            <span id="cb-logo">▓</span>
            <span id="cb-wordmark">ContextBar</span>
            <span id="cb-platform-badge" title="${platform ? platform.name : 'Unknown'}">${platform ? platform.badge : '?'}</span>
          </div>
          <div id="cb-controls">
            <button class="cb-ctrl-btn" id="cb-minimize-btn" title="Minimize">╌</button>
            <button class="cb-ctrl-btn" id="cb-close-btn" title="Hide panel">✕</button>
          </div>
        </div>

        <div id="cb-body">
          <div id="cb-stats-row">
            <div class="cb-stat-cell">
              <div class="cb-stat-label">TOKENS</div>
              <div class="cb-stat-val" id="cb-s-tokens">—</div>
            </div>
            <div class="cb-stat-divider"></div>
            <div class="cb-stat-cell">
              <div class="cb-stat-label">LIMIT</div>
              <div class="cb-stat-val" id="cb-s-limit">—</div>
            </div>
            <div class="cb-stat-divider"></div>
            <div class="cb-stat-cell">
              <div class="cb-stat-label">IN MEM</div>
              <div class="cb-stat-val" id="cb-s-mem">—</div>
            </div>
          </div>

          <div id="cb-tokenizer-row">
            <span class="cb-section-label">TOKENIZER</span>
            <span id="cb-tok-source" class="cb-tok-badge">loading…</span>
          </div>

          <div id="cb-bar-section">
            <div id="cb-bar-header">
              <span class="cb-section-label">MEMORY HEALTH</span>
              <span id="cb-bar-pct">0%</span>
            </div>
            <div id="cb-bar-track">
              <div id="cb-bar-fill"></div>
              <div id="cb-bar-danger-zone"></div>
              <div id="cb-bar-cliff"></div>
            </div>
            <div id="cb-bar-ruler">
              <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
            </div>
          </div>

          <div id="cb-trace-section">
            <div class="cb-section-label">MESSAGE TRACE</div>
            <div id="cb-trace-list">
              <div class="cb-trace-waiting">↻ Waiting for messages…</div>
            </div>
          </div>

          <div id="cb-prune-section" style="display:none">
            <div id="cb-prune-header">
              <span class="cb-section-label">PRUNE SUGGESTIONS</span>
              <span id="cb-prune-saving"></span>
            </div>
            <div id="cb-prune-list"></div>
            <div id="cb-prune-tip">Removing these would free the most context space.</div>
          </div>

          <div id="cb-halluc-section" style="display:none">
            <div id="cb-halluc-header">
              <span class="cb-section-label">HALLUCINATION RISK</span>
              <label id="cb-halluc-toggle-label" title="Toggle highlights on page">
                <input type="checkbox" id="cb-halluc-toggle" checked>
                <span id="cb-halluc-toggle-text">highlights on</span>
              </label>
            </div>
            <div id="cb-halluc-list"></div>
            <div id="cb-halluc-tip">Sentences highlighted on page. Hover for reason.</div>
          </div>

          <div id="cb-legend">
            <div class="cb-legend-item">
              <span class="cb-legend-dot" style="background:var(--cb-green)"></span>
              <span>In context</span>
            </div>
            <div class="cb-legend-item">
              <span class="cb-legend-dot" style="background:var(--cb-amber)"></span>
              <span>At risk</span>
            </div>
            <div class="cb-legend-item">
              <span class="cb-legend-dot" style="background:var(--cb-grey)"></span>
              <span>Forgotten</span>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(this.panel);
      this._checkTokenizer();
    }

    _checkTokenizer() {
      const set = () => {
        const badge = document.getElementById('cb-tok-source');
        if (!badge) return;
        if (window.CB_TOKENIZER && window.CB_TOKENIZER.healthy) {
          badge.textContent = 'cl100k';
          badge.classList.add('cb-tok-exact');
          badge.title = 'cl100k_base — ~98% accurate';
        } else {
          badge.textContent = '~est';
          badge.title = 'Heuristic fallback';
        }
      };
      set();
      setTimeout(set, 500);
    }

    // ─────────────────────────────────────────
    // EVENTS
    // ─────────────────────────────────────────

    bindEvents() {
      this.panel.querySelector('#cb-close-btn').addEventListener('click', () => this.hide());

      let minimized = false;
      this.panel.querySelector('#cb-minimize-btn').addEventListener('click', () => {
        minimized = !minimized;
        this.panel.querySelector('#cb-body').style.display = minimized ? 'none' : 'flex';
        this.panel.querySelector('#cb-minimize-btn').textContent = minimized ? '□' : '╌';
      });

      this.makeDraggable(this.panel.querySelector('#cb-drag-handle'));

      // Hallucination highlight toggle
      this.panel.addEventListener('change', (e) => {
        if (e.target.id !== 'cb-halluc-toggle') return;
        const on = e.target.checked;
        if (window.CB_HALLUCINATION) window.CB_HALLUCINATION.setEnabled(on);
        const label = document.getElementById('cb-halluc-toggle-text');
        if (label) label.textContent = on ? 'highlights on' : 'highlights off';
      });
    }

    makeDraggable(handle) {
      let startX, startY, originL, originT;
      handle.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('cb-ctrl-btn')) return;
        this.isDragging = true;
        startX = e.clientX; startY = e.clientY;
        const rect = this.panel.getBoundingClientRect();
        originL = rect.left; originT = rect.top;
        this.panel.style.transition = 'none';
        this.panel.style.userSelect = 'none';
        e.preventDefault();
      });
      document.addEventListener('mousemove', (e) => {
        if (!this.isDragging) return;
        this.panel.style.left   = Math.max(0, originL + (e.clientX - startX)) + 'px';
        this.panel.style.top    = Math.max(0, originT + (e.clientY - startY)) + 'px';
        this.panel.style.right  = 'auto';
        this.panel.style.bottom = 'auto';
      });
      document.addEventListener('mouseup', () => {
        this.isDragging = false;
        this.panel.style.userSelect = '';
      });
    }

    hide() {
      this.panel.style.display = 'none';
      if (this.restoreBtn) return;
      this.restoreBtn = document.createElement('button');
      this.restoreBtn.id = 'cb-restore-btn';
      this.restoreBtn.innerHTML = '▓';
      this.restoreBtn.title = 'Show ContextBar';
      this.restoreBtn.addEventListener('click', () => {
        this.panel.style.display = 'flex';
        this.restoreBtn.remove();
        this.restoreBtn = null;
      });
      document.body.appendChild(this.restoreBtn);
    }

    // ─────────────────────────────────────────
    // MUTATION OBSERVER
    // ─────────────────────────────────────────

    startObserving() {
      this.observer = new MutationObserver(() => {
        clearTimeout(this.updateTimer);
        this.updateTimer = setTimeout(() => this.update(), 500);
      });
      this.observer.observe(document.body, {
        childList: true, subtree: true,
        characterData: false, attributes: false,
      });
    }

    // ─────────────────────────────────────────
    // CORE UPDATE — never returns early on no messages
    // ─────────────────────────────────────────

    update() {
      try {
        // No platform match — show notice but keep panel visible
        if (!platform) {
          const trList = document.getElementById('cb-trace-list');
          if (trList) trList.innerHTML = `<div class="cb-trace-waiting cb-trace-warn">⚠ Platform not supported</div>`;
          return;
        }

        // Always render the context limit
        const contextLimit = platform.getContextLimit();
        const limEl = document.getElementById('cb-s-limit');
        if (limEl) limEl.textContent = fmtK(contextLimit);

        // Attempt message extraction
        let rawMsgs = [];
        try { rawMsgs = platform.getMessages(); } catch (_) {}

        // No messages yet — show waiting state, do NOT clear existing data
        if (!rawMsgs.length) {
          if (!this.hasData) {
            const trList = document.getElementById('cb-trace-list');
            if (trList) {
              trList.innerHTML = `<div class="cb-trace-waiting">↻ Waiting for messages… send a message to begin</div>`;
            }
          }
          return;
        }

        // ── We have messages ──────────────────────────────────
        this.hasData = true;

        const messages = rawMsgs.map((m) => ({
          ...m,
          tokens: countTokens(m.text),
        }));

        const totalTokens = messages.reduce((s, m) => s + m.tokens, 0);

        // Core window assignment — UNCHANGED
        let remaining = contextLimit;
        const statusMap = new Array(messages.length).fill('grey');
        for (let i = messages.length - 1; i >= 0; i--) {
          const t = messages[i].tokens;
          if (remaining >= t) {
            remaining -= t;
            statusMap[i] = 'green';
          } else if (remaining > 0 && remaining >= t * 0.3) {
            statusMap[i] = 'amber';
            remaining = 0;
          } else {
            statusMap[i] = 'grey';
          }
        }

        const inContextCount = statusMap.filter((s) => s === 'green').length;
        const pct = Math.min(100, (totalTokens / contextLimit) * 100);
        const pruneCandidates = computePruneScores(messages, statusMap);

        this.renderStats(totalTokens, contextLimit, inContextCount, messages.length);
        this.renderHealthBar(pct);

        // Hallucination analysis — runs before renderTrace so badges are available
        let hallucResults = [];
        if (window.CB_HALLUCINATION) {
          try { hallucResults = window.CB_HALLUCINATION.process(messages); } catch (_) {}
        }

        this.renderTrace(messages, statusMap, pruneCandidates, hallucResults);
        this.renderPruneSuggestions(pruneCandidates, pct);
        this.renderHallucination(hallucResults);
        this.paintChatMessages(messages, statusMap);

      } catch (err) {
        console.warn('[ContextBar] update error:', err);
      }
    }

    renderStats(tokens, limit, inCtx, total) {
      document.getElementById('cb-s-tokens').textContent = fmtK(tokens);
      document.getElementById('cb-s-limit').textContent  = fmtK(limit);
      document.getElementById('cb-s-mem').textContent    = `${inCtx}/${total}`;
    }

    renderHealthBar(pct) {
      const fill  = document.getElementById('cb-bar-fill');
      const pctEl = document.getElementById('cb-bar-pct');
      const cliff = document.getElementById('cb-bar-cliff');

      let color = 'var(--cb-green)';
      if (pct >= 95) color = 'var(--cb-red)';
      else if (pct >= 75) color = 'var(--cb-amber)';

      fill.style.width      = Math.min(pct, 100) + '%';
      fill.style.background = color;
      pctEl.textContent     = Math.round(pct) + '%';
      pctEl.style.color     = color;
      cliff.style.display   = pct >= 1 ? 'block' : 'none';
      if (pct >= 1) cliff.style.left = Math.min(pct, 99.5) + '%';
    }

    renderTrace(messages, statusMap, pruneCandidates, hallucResults = []) {
      const list = document.getElementById('cb-trace-list');
      list.innerHTML = '';
      const pruneIdxSet   = new Set(pruneCandidates.map((c) => c.index));
      const hallucRiskMap = new Map(hallucResults.map((r) => [r.msgIndex, r]));

      messages.forEach((msg, i) => {
        const status     = statusMap[i];
        const isUser     = msg.role === 'user';
        const isPrunable = pruneIdxSet.has(i);
        const halluc     = hallucRiskMap.get(i);
        const preview    = msg.text.replace(/\n+/g, ' ').substring(0, 55);
        const statusLabel = status === 'green' ? 'In context' : status === 'amber' ? 'At risk' : 'Forgotten';

        const row = document.createElement('div');
        row.className = `cb-trace-row cb-trace-${status}${isPrunable ? ' cb-trace-prunable' : ''}`;
        row.title = `${msg.tokens} tokens — ${statusLabel}${isPrunable ? ' — prune candidate' : ''}`;

        // Build the indicator: prune scissors takes priority, then halluc badge, then status dot
        let indicator;
        if (isPrunable) {
          indicator = `<span class="cb-prune-scissor" title="Prune candidate">✂</span>`;
        } else if (halluc && !isUser) {
          const badge = halluc.level === 'high' ? '⚠' : '◈';
          indicator = `<span class="cb-halluc-dot cb-halluc-dot-${halluc.level}" title="${halluc.count} risk signal${halluc.count > 1 ? 's' : ''}">${badge}</span>`;
        } else {
          indicator = status === 'green' ? '●' : status === 'amber' ? '◐' : '○';
        }

        row.innerHTML = `
          <div class="cb-trace-role cb-role-${isUser ? 'user' : 'ai'}">${isUser ? 'U' : 'A'}</div>
          <div class="cb-trace-body">
            <div class="cb-trace-preview">${escapeHTML(preview)}${msg.text.length > 55 ? '…' : ''}</div>
            <div class="cb-trace-tokens">${fmtK(msg.tokens)} tok</div>
          </div>
          <div class="cb-trace-indicator cb-ind-${status}">${indicator}</div>
        `;
        list.appendChild(row);
      });

      const forgotten = statusMap.filter((s) => s === 'grey').length;
      if (forgotten > 0) {
        const notice = document.createElement('div');
        notice.id = 'cb-forgotten-notice';
        notice.innerHTML = `⚠ ${forgotten} message${forgotten > 1 ? 's' : ''} outside context window`;
        list.appendChild(notice);
      }
    }

    renderPruneSuggestions(candidates, pct) {
      const section  = document.getElementById('cb-prune-section');
      const list     = document.getElementById('cb-prune-list');
      const savingEl = document.getElementById('cb-prune-saving');

      if (pct < 60 || !candidates.length) { section.style.display = 'none'; return; }

      section.style.display = 'flex';
      savingEl.textContent  = `−${fmtK(candidates.reduce((s, c) => s + c.tokens, 0))} tok`;
      list.innerHTML = '';

      candidates.forEach((c, rank) => {
        const preview = c.msg.text.replace(/\n+/g, ' ').substring(0, 44);
        const isUser  = c.msg.role === 'user';
        const card    = document.createElement('div');
        card.className = 'cb-prune-card';
        card.title     = `Message #${c.index + 1} — ${c.reason}`;
        card.innerHTML = `
          <div class="cb-prune-rank">#${rank + 1}</div>
          <div class="cb-prune-card-body">
            <div class="cb-prune-card-preview">
              <span class="cb-prune-role-dot cb-role-dot-${isUser ? 'user' : 'ai'}"></span>
              ${escapeHTML(preview)}${c.msg.text.length > 44 ? '…' : ''}
            </div>
            <div class="cb-prune-card-meta">
              <span class="cb-prune-reason">${c.reason}</span>
              <span class="cb-prune-tok-save">−${fmtK(c.tokens)} tok</span>
            </div>
          </div>
        `;
        list.appendChild(card);
      });
    }

    renderHallucination(results) {
      const section = document.getElementById('cb-halluc-section');
      const list    = document.getElementById('cb-halluc-list');
      if (!section || !list) return;

      if (!results.length) { section.style.display = 'none'; return; }

      section.style.display = 'flex';
      list.innerHTML = '';

      results.forEach((r) => {
        const highCount = r.sentences.filter((s) => s.level === 'high').length;
        const midCount  = r.sentences.filter((s) => s.level === 'medium').length;

        const card = document.createElement('div');
        card.className = `cb-halluc-card cb-halluc-card-${r.level}`;

        // Show top 2 reasons
        const topReasons = [...new Set(
          r.sentences.flatMap((s) => s.reasons)
        )].slice(0, 2);

        card.innerHTML = `
          <div class="cb-halluc-card-left">
            <span class="cb-halluc-level-badge cb-halluc-${r.level}">
              ${r.level === 'high' ? '⚠ HIGH' : r.level === 'medium' ? '◈ MED' : '· LOW'}
            </span>
          </div>
          <div class="cb-halluc-card-body">
            <div class="cb-halluc-counts">
              ${highCount ? `<span class="cb-halluc-count-high">${highCount} high</span>` : ''}
              ${midCount  ? `<span class="cb-halluc-count-mid">${midCount} medium</span>` : ''}
            </div>
            <div class="cb-halluc-reasons">${topReasons.map(escapeHTML).join(' · ')}</div>
          </div>
        `;
        list.appendChild(card);
      });
    }

    paintChatMessages(messages, statusMap) {
      messages.forEach((msg, i) => {
        if (!msg.el) return;
        msg.el.classList.remove('cb-in-ctx', 'cb-at-risk', 'cb-forgotten');
        if (statusMap[i] === 'green')      msg.el.classList.add('cb-in-ctx');
        else if (statusMap[i] === 'amber') msg.el.classList.add('cb-at-risk');
        else                               msg.el.classList.add('cb-forgotten');
      });
    }
  }

  // ═══════════════════════════════════════════════════════════
  // UTILITIES
  // ═══════════════════════════════════════════════════════════

  function fmtK(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000)    return (n / 1000).toFixed(1) + 'k';
    return String(n);
  }

  function escapeHTML(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ═══════════════════════════════════════════════════════════
  // BOOT — run immediately, don't wait
  // ═══════════════════════════════════════════════════════════

  function boot() {
    if (document.body) {
      new ContextBar();
    } else {
      setTimeout(boot, 200);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();
