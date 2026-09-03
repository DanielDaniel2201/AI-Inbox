import { createDOMAdapter } from "../dom-adapter";
import type { ConversationInfo } from "../types";
import { selectors } from "./selectors";

function conversation(): ConversationInfo | null {
  const id = location.pathname.match(/(?:^|\/)c\/([^/?#]+)/)?.[1];
  if (!id) return null;
  const title = document.title.replace(/\s*[-–|]\s*ChatGPT\s*$/i, "").trim();
  return {
    provider: "chatgpt",
    conversationId: id,
    ...(title && title !== "ChatGPT" ? { title } : {}),
    url: `${location.origin}${location.pathname}`,
  };
}

export const chatGPTAdapter = createDOMAdapter({
  id: "chatgpt",
  hosts: ["chatgpt.com"],
  conversation,
  assistantSelector: selectors.assistant,
  promptSelector: selectors.prompt,
  sendSelector: selectors.send,
  stopSelector: selectors.stop,
});
