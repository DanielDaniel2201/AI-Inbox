import type { AIEvent, ConversationInfo, Provider } from "../adapters/types";
import { AttentionManager } from "../core/attention-manager";
import { clearPendingForTab, detachTab } from "../core/state";
import { onStateChanged, readState, updateState } from "../core/store";
import { handleAIEvent } from "../core/task-manager";
import type { AIInboxState, InboxItem, PendingTask } from "../core/types";

const attention = new AttentionManager();
let iconAnimation: ReturnType<typeof setInterval> | undefined;
let iconFrame = 0;
const providerHosts: Record<Provider, string> = {
  chatgpt: "chatgpt.com",
  deepseek: "chat.deepseek.com",
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "get_state") {
    void readState().then((state) => sendResponse({ state }));
    return true;
  }

  const run = async () => {
    if (message?.type === "content_ready" && sender.tab?.id !== undefined) {
      // ponytail: reload resets in-flight work; add request IDs before resuming it safely.
      const tabId = sender.tab.id;
      await updateState((state) => clearPendingForTab(state, tabId));
    } else if (message?.type === "ai_event" && sender.tab?.id !== undefined) {
      const event = message.event as AIEvent;
      if (validEvent(event, sender.tab.url)) {
        await handleAIEvent(event, sender.tab.id, (id) => attention.isAttended(id));
      }
    } else if (message?.type === "conversation_changed" && sender.tab?.id !== undefined) {
      const conversation = message.conversation as ConversationInfo;
      if (validConversation(conversation, sender.tab.url)) {
        await attention.noteConversation(sender.tab.id, conversation);
      }
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

onStateChanged((state) => {
  void updateAction(state);
  void chrome.runtime.sendMessage({ type: "state_changed", state }).catch(() => undefined);
});
void readState().then(updateAction);

async function updateAction(state: AIInboxState): Promise<void> {
  clearInterval(iconAnimation);
  iconAnimation = undefined;
  const pending = Object.keys(state.pendingTasks).length;
  const unread = Object.keys(state.inboxItems).length;
  const total = pending + unread;
  await chrome.action.setPopup({ popup: total ? "popup.html" : "" });

  if (pending) {
    await chrome.action.setBadgeBackgroundColor({ color: "#111111" });
    await chrome.action.setBadgeText({ text: String(total) });
    const paint = () => {
      void chrome.action.setIcon({ imageData: actionIcon(true, iconFrame++) });
    };
    paint();
    iconAnimation = setInterval(paint, 200);
  } else {
    await chrome.action.setIcon({ imageData: actionIcon(false, 0) });
    await chrome.action.setBadgeBackgroundColor({ color: "#111111" });
    await chrome.action.setBadgeText({ text: unread ? String(unread) : "" });
  }
  await chrome.action.setTitle({
    title: pending
      ? `AI inbox · ${pending} working · ${unread} unread`
      : `AI inbox · ${unread} unread`,
  });
}

function actionIcon(spinning: boolean, frame: number): Record<number, ImageData> {
  return {
    16: drawActionIcon(16, spinning, frame),
    32: drawActionIcon(32, spinning, frame),
  };
}

function drawActionIcon(size: number, spinning: boolean, frame: number): ImageData {
  const canvas = new OffscreenCanvas(size, size);
  const context = canvas.getContext("2d")!;
  const center = size / 2;

  if (spinning) {
    for (let index = 0; index < 10; index++) {
      const angle = ((index + frame) / 10) * Math.PI * 2;
      context.globalAlpha = 0.2 + (index / 10) * 0.8;
      context.fillStyle = "#111111";
      context.beginPath();
      context.arc(
        center + Math.cos(angle) * size * 0.39,
        center + Math.sin(angle) * size * 0.39,
        size * 0.055,
        0,
        Math.PI * 2,
      );
      context.fill();
    }
    context.globalAlpha = 1;
  } else {
    drawInbox(context, size);
  }

  return context.getImageData(0, 0, size, size);
}

// Lucide Inbox: https://lucide.dev/icons/inbox
function drawInbox(context: OffscreenCanvasRenderingContext2D, size: number): void {
  context.scale(size / 24, size / 24);
  context.lineCap = "round";
  context.lineJoin = "round";

  for (const [color, width] of [["white", 4], ["#111111", 2]] as const) {
    context.strokeStyle = color;
    context.lineWidth = width;
    context.beginPath();
    context.moveTo(22, 12);
    context.lineTo(16, 12);
    context.lineTo(14, 15);
    context.lineTo(10, 15);
    context.lineTo(8, 12);
    context.lineTo(2, 12);
    context.stroke();
    context.stroke(new Path2D(
      "M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z",
    ));
  }
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
  const event = value as Partial<AIEvent> & { prompt?: unknown; preview?: unknown };
  return (
    event.type === "prompt_submitted" ||
    event.type === "response_started" ||
    event.type === "response_completed"
  ) && (event.prompt === undefined || typeof event.prompt === "string") &&
    (event.preview === undefined || typeof event.preview === "string") &&
    validConversation(event.conversation, senderUrl);
}

async function openItem(id: string): Promise<void> {
  const state = await readState();
  const item = state.inboxItems[id] ?? state.pendingTasks[id];
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

function validItemUrl(item: InboxItem | PendingTask): boolean {
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
