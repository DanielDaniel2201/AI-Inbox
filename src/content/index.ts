import { chatGPTAdapter } from "../adapters/chatgpt/adapter";
import { claudeAdapter } from "../adapters/claude/adapter";
import { deepSeekAdapter } from "../adapters/deepseek/adapter";
import type { ConversationInfo } from "../adapters/types";

const adapter = [chatGPTAdapter, deepSeekAdapter, claudeAdapter].find((candidate) =>
  candidate.match(location.href),
);

if (adapter) {
  let lastConversation = "";

  const send = (message: unknown) => {
    void chrome.runtime.sendMessage(message).catch(() => undefined);
  };
  send({ type: "content_ready" });

  const syncConversation = () => {
    const conversation = adapter.getConversation();
    const fingerprint = conversation
      ? `${conversation.provider}:${conversation.conversationId}:${conversation.title ?? ""}`
      : "";
    if (fingerprint !== lastConversation) {
      lastConversation = fingerprint;
      if (conversation) send({ type: "conversation_changed", conversation });
    }
  };
  adapter.observe((event) => send({ type: "ai_event", event }));
  syncConversation();
  new MutationObserver(syncConversation).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  addEventListener("popstate", syncConversation);

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "get_conversation") return;
    sendResponse({ conversation: adapter.getConversation() satisfies ConversationInfo | null });
  });
}
