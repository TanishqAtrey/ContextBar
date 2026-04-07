const SUPPORTED_HOSTS = [
  'chat.openai.com',
  'chatgpt.com',
  'claude.ai',
  'gemini.google.com',
  'perplexity.ai',
  'chat.mistral.ai',
  'poe.com',
];

const PLATFORM_NAMES = {
  'chat.openai.com': 'ChatGPT',
  'chatgpt.com': 'ChatGPT',
  'claude.ai': 'Claude',
  'gemini.google.com': 'Gemini',
  'perplexity.ai': 'Perplexity',
  'chat.mistral.ai': 'Mistral',
  'poe.com': 'Poe',
};

chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  if (!tab || !tab.url) return;

  let url;
  try { url = new URL(tab.url); } catch { return; }

  const host = url.hostname;
  const matchedKey = SUPPORTED_HOSTS.find((h) => host.includes(h));

  const dot = document.getElementById('popup-status-dot');
  const statusText = document.getElementById('popup-status-text');

  if (matchedKey) {
    const name = PLATFORM_NAMES[matchedKey] || matchedKey;
    dot.classList.add('active');
    statusText.classList.add('active');
    statusText.textContent = `Active on ${name}`;
  } else {
    statusText.textContent = 'Navigate to a supported LLM chat';
    dot.style.background = '#626878';
  }
});
