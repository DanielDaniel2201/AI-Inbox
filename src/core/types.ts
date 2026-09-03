import type { Provider } from "../adapters/types";

export interface PendingTask {
  id: string;
  provider: Provider;
  conversationId: string;
  conversationUrl: string;
  tabId: number;
  startedAt: number;
}

export interface InboxItem {
  id: string;
  provider: Provider;
  conversationId: string;
  conversationTitle?: string;
  conversationUrl: string;
  preview?: string;
  tabId?: number;
  completedAt: number;
}

export interface AIInboxState {
  pendingTasks: Record<string, PendingTask>;
  inboxItems: Record<string, InboxItem>;
}
