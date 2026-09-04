import { createDOMAdapter } from "../dom-adapter";
import type { ConversationInfo } from "../types";
import { selectors } from "./selectors";

function conversation(): ConversationInfo | null {
  const id = location.pathname.match(/(?:^|\/)chat\/([^/?#]+)/)?.[1];
  if (!id) return null;
  const title = document.title.replace(/\s*[-–|]\s*Claude\s*$/i, "").trim();
  return {
    provider: "claude",
    conversationId: id,
    ...(title && title !== "Claude" ? { title } : {}),
    url: `${location.origin}${location.pathname}`,
  };
}

export const claudeAdapter = createDOMAdapter({
  id: "claude",
  hosts: ["claude.ai"],
  conversation,
  assistantSelector: selectors.assistant,
  promptSelector: selectors.prompt,
  sendSelector: selectors.send,
  stopSelector: selectors.stop,
});
