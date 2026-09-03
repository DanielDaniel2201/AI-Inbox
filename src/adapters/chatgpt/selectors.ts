export const selectors = {
  user: '[data-message-author-role="user"]',
  assistant: '[data-message-author-role="assistant"]',
  prompt: '#prompt-textarea, textarea[placeholder]',
  send: '#composer-submit-button, button[data-testid="send-button"]',
  stop: 'button[data-testid="stop-button"], button[aria-label*="stop generating" i]',
} as const;
