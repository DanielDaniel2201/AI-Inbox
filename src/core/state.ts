import type { AIEvent, ConversationInfo, Provider } from "../adapters/types";
import type { AIInboxState, InboxItem, PendingTask } from "./types";

export const emptyState = (): AIInboxState => ({ pendingTasks: {}, inboxItems: {} });
export const conversationKey = (provider: Provider, conversationId: string) =>
  `${provider}:${conversationId}`;

export function applyAIEvent(
  state: AIInboxState,
  event: AIEvent,
  tabId: number,
  attended: boolean,
  now = Date.now(),
): AIInboxState {
  const { conversation } = event;
  const id = conversationKey(conversation.provider, conversation.conversationId);
  const pendingTasks = { ...state.pendingTasks };
  const inboxItems = { ...state.inboxItems };

  if (event.type !== "response_completed") {
    const existing = pendingTasks[id];
    const title = conversation.title ?? existing?.conversationTitle;
    const prompt = event.type === "prompt_submitted" ? event.prompt : existing?.latestPrompt;
    delete inboxItems[id];
    pendingTasks[id] = {
      id,
      provider: conversation.provider,
      conversationId: conversation.conversationId,
      ...(title ? { conversationTitle: title } : {}),
      conversationUrl: conversation.url,
      ...(prompt ? { latestPrompt: prompt } : {}),
      tabId,
      startedAt: existing?.startedAt ?? now,
    } satisfies PendingTask;
  } else {
    const pending = pendingTasks[id];
    delete pendingTasks[id];
    if (attended) {
      delete inboxItems[id];
    } else {
      const title = conversation.title ?? pending?.conversationTitle;
      inboxItems[id] = {
        id,
        provider: conversation.provider,
        conversationId: conversation.conversationId,
        ...(title ? { conversationTitle: title } : {}),
        conversationUrl: conversation.url,
        ...(pending?.latestPrompt ? { latestPrompt: pending.latestPrompt } : {}),
        ...(event.preview ? { preview: event.preview } : {}),
        tabId,
        completedAt: now,
      } satisfies InboxItem;
    }
  }

  return { pendingTasks, inboxItems };
}

export function bindConversation(
  state: AIInboxState,
  tabId: number,
  conversation: ConversationInfo,
): AIInboxState {
  const currentId = conversationKey(conversation.provider, conversation.conversationId);
  let changed = false;
  const inboxItems = Object.fromEntries(
    Object.entries(state.inboxItems).map(([id, item]) => {
      if (item.tabId === tabId && id !== currentId) {
        changed = true;
        const { tabId: _tabId, ...detached } = item;
        return [id, detached];
      }
      if (id === currentId && (
        item.tabId !== tabId ||
        item.conversationUrl !== conversation.url ||
        (conversation.title && item.conversationTitle !== conversation.title)
      )) {
        changed = true;
        return [id, {
          ...item,
          tabId,
          conversationUrl: conversation.url,
          conversationTitle: conversation.title ?? item.conversationTitle,
        }];
      }
      return [id, item];
    }),
  );
  return changed ? { ...state, inboxItems } : state;
}

export function removeConversation(
  state: AIInboxState,
  conversation: ConversationInfo,
): AIInboxState {
  const id = conversationKey(conversation.provider, conversation.conversationId);
  if (!state.inboxItems[id]) return state;
  const inboxItems = { ...state.inboxItems };
  delete inboxItems[id];
  return { ...state, inboxItems };
}

export function dismissItem(state: AIInboxState, id: string): AIInboxState {
  if (!state.inboxItems[id]) return state;
  const inboxItems = { ...state.inboxItems };
  delete inboxItems[id];
  return { ...state, inboxItems };
}

export function clearPendingForTab(state: AIInboxState, tabId: number): AIInboxState {
  const pendingTasks = Object.fromEntries(
    Object.entries(state.pendingTasks).filter(([, task]) => task.tabId !== tabId),
  );
  return Object.keys(pendingTasks).length === Object.keys(state.pendingTasks).length
    ? state
    : { ...state, pendingTasks };
}

export function detachTab(state: AIInboxState, tabId: number): AIInboxState {
  let changed = false;
  const pendingTasks = Object.fromEntries(
    Object.entries(state.pendingTasks).filter(([, task]) => {
      if (task.tabId !== tabId) return true;
      changed = true;
      return false;
    }),
  );
  const inboxItems = Object.fromEntries(
    Object.entries(state.inboxItems).map(([id, item]) => {
      if (item.tabId !== tabId) return [id, item];
      changed = true;
      const { tabId: _tabId, ...detached } = item;
      return [id, detached];
    }),
  );
  return changed ? { pendingTasks, inboxItems } : state;
}
