export const selectors = {
  user:
    '[data-message-author-role="user"], [data-role="user"], [class*="message"][class*="user"]',
  assistant:
    '[data-message-author-role="assistant"], [data-role="assistant"], .ds-assistant-message-main-content',
  prompt: 'textarea, [contenteditable="true"]',
  send:
    'button[aria-label*="send" i], button[aria-label*="发送"], [role="button"][aria-label*="send" i], .ds-button--primary.ds-button--circle',
  stop:
    'button[data-testid*="stop" i], button[aria-label*="stop" i], button[aria-label*="停止"], [role="button"][aria-label*="stop" i], [role="button"][aria-label*="停止"], .ds-button--primary.ds-button--circle:has(path[d^="M2 4.88"])',
} as const;
