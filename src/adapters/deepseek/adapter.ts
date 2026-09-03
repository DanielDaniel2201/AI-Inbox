import { createDOMAdapter } from "../dom-adapter";
import type { ConversationInfo } from "../types";
import { selectors } from "./selectors";

function conversation(): ConversationInfo | null {
  const id = location.pathname.match(/(?:^|\/)chat\/s\/([^/?#]+)/)?.[1];
  if (!id) return null;
  const title = document.title.replace(/\s*[-–|]\s*DeepSeek\s*$/i, "").trim();
  return {
    provider: "deepseek",
    conversationId: id,
    ...(title && title !== "DeepSeek" ? { title } : {}),
    url: `${location.origin}${location.pathname}`,
  };
}

export const deepSeekAdapter = createDOMAdapter({
  id: "deepseek",
  hosts: ["chat.deepseek.com"],
  conversation,
  userSelector: selectors.user,
  assistantSelector: selectors.assistant,
  promptSelector: selectors.prompt,
  sendSelector: selectors.send,
  stopSelector: selectors.stop,
  // ponytail: DOM-idle fallback; replace with a stable stop selector if DeepSeek exposes one.
  fallbackIdleMs: 2500,
});
