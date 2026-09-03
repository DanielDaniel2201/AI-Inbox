import type { AIEvent, ConversationInfo, Provider } from "../adapters/types";
import { AttentionManager } from "../core/attention-manager";
import { detachTab, dismissItem } from "../core/state";
import { initializeState, readState, STORAGE_KEY, updateState } from "../core/storage";
import { handleAIEvent } from "../core/task-manager";
import type { AIInboxState, InboxItem } from "../core/types";

const attention = new AttentionManager();
const providerHosts: Record<Provider, string> = {
  chatgpt: "chatgpt.com",
  deepseek: "chat.deepseek.com",
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const run = async () => {
    if (message?.type === "ai_event" && sender.tab?.id !== undefined) {
      const event = message.event as AIEvent;
      if (validEvent(event, sender.tab.url)) {
        await handleAIEvent(event, sender.tab.id, (id) => attention.isAttended(id));
      }
    } else if (message?.type === "conversation_changed" && sender.tab?.id !== undefined) {
      const conversation = message.conversation as ConversationInfo;
      if (validConversation(conversation, sender.tab.url)) {
        await attention.noteConversation(sender.tab.id, conversation);
      }
    } else if (message?.type === "dismiss_item" && typeof message.id === "string") {
      await updateState((state) => dismissItem(state, message.id));
    } else if (message?.type === "open_item" && typeof message.id === "string") {
      await openItem(message.id);
    }
  };
  void run().then(() => sendResponse({ ok: true }), () => sendResponse({ ok: false }));
  return true;
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  attention.cancelAll();
  void attention.refreshTab(tabId);
});

chrome.windows.onFocusChanged.addListener((windowId) => {
  attention.cancelAll();
  if (windowId !== chrome.windows.WINDOW_ID_NONE) {
    void chrome.tabs.query({ active: true, windowId }).then(([tab]) => {
      if (tab?.id !== undefined) void attention.refreshTab(tab.id);
    });
  }
});

chrome.tabs.onUpdated.addListener((tabId, change) => {
  if (change.status === "complete") void attention.refreshTab(tabId);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  attention.forget(tabId);
  void updateState((state) => detachTab(state, tabId));
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes[STORAGE_KEY]?.newValue) {
    void updateBadge(changes[STORAGE_KEY].newValue as AIInboxState);
  }
});

void initializeState().then(updateBadge);

async function updateBadge(state: AIInboxState): Promise<void> {
  const count = Object.keys(state.inboxItems).length;
  await chrome.action.setBadgeBackgroundColor({ color: "#6d5dfc" });
  await chrome.action.setBadgeText({ text: count ? String(count) : "" });
}

function validConversation(value: unknown, senderUrl?: string): value is ConversationInfo {
  if (!value || typeof value !== "object") return false;
  const conversation = value as Partial<ConversationInfo>;
  if (
    (conversation.provider !== "chatgpt" && conversation.provider !== "deepseek") ||
    typeof conversation.conversationId !== "string" ||
    !conversation.conversationId ||
    typeof conversation.url !== "string"
  ) return false;
  try {
    const expectedHost = providerHosts[conversation.provider];
    return new URL(conversation.url).hostname === expectedHost &&
      (!senderUrl || new URL(senderUrl).hostname === expectedHost);
  } catch {
    return false;
  }
}

function validEvent(value: unknown, senderUrl?: string): value is AIEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Partial<AIEvent>;
  return (
    event.type === "prompt_submitted" ||
    event.type === "response_started" ||
    event.type === "response_completed"
  ) && validConversation(event.conversation, senderUrl);
}

async function openItem(id: string): Promise<void> {
  const item = (await readState()).inboxItems[id];
  if (!item || !validItemUrl(item)) return;
  const wanted = canonicalUrl(item.conversationUrl);
  let tab: chrome.tabs.Tab | undefined;

  if (item.tabId !== undefined) {
    try {
      const candidate = await chrome.tabs.get(item.tabId);
      if (candidate.url && canonicalUrl(candidate.url) === wanted) tab = candidate;
    } catch {
      // The original tab was closed.
    }
  }
  if (!tab) {
    tab = (await chrome.tabs.query({})).find(
      (candidate) => candidate.url && canonicalUrl(candidate.url) === wanted,
    );
  }
  if (tab?.id !== undefined) {
    await chrome.tabs.update(tab.id, { active: true });
    await chrome.windows.update(tab.windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url: item.conversationUrl, active: true });
  }
}

function validItemUrl(item: InboxItem): boolean {
  try {
    return new URL(item.conversationUrl).hostname === providerHosts[item.provider];
  } catch {
    return false;
  }
}

function canonicalUrl(url: string): string {
  const parsed = new URL(url);
  return `${parsed.origin}${parsed.pathname.replace(/\/$/, "")}`;
}
