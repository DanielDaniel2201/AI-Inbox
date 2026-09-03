import type { Provider } from "../adapters/types";

export interface PendingTask {
  id: string;
  provider: Provider;
  conversationId: string;
  conversationTitle?: string;
  conversationUrl: string;
  latestPrompt?: string;
  tabId: number;
  startedAt: number;
}

export interface InboxItem {
  id: string;
  provider: Provider;
  conversationId: string;
  conversationTitle?: string;
  conversationUrl: string;
  latestPrompt?: string;
  preview?: string;
  tabId?: number;
  completedAt: number;
}

export interface AIInboxState {
  pendingTasks: Record<string, PendingTask>;
  inboxItems: Record<string, InboxItem>;
}
