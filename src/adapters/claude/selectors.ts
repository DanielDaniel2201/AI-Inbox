export const selectors = {
  assistant: "[data-is-streaming]",
  prompt: '[data-testid="chat-input"]',
  send: '[data-testid="chat-input-send"], button[aria-label="Send message"]',
  stop: 'button[aria-label="Stop response"]',
} as const;
