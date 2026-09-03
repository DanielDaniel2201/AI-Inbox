import type { ConversationInfo } from "../adapters/types";
import { bindConversation, removeConversation } from "./state";
import { updateState } from "./store";

const READ_DELAY_MS = 1000;

export class AttentionManager {
  private conversations = new Map<number, ConversationInfo>();
  private timers = new Map<number, ReturnType<typeof setTimeout>>();
  private generations = new Map<number, number>();

  async isAttended(tabId: number): Promise<boolean> {
    try {
      const tab = await chrome.tabs.get(tabId);
      if (!tab.active || tab.windowId === undefined) return false;
      return (await chrome.windows.get(tab.windowId)).focused;
    } catch {
      return false;
    }
  }

  async noteConversation(tabId: number, conversation: ConversationInfo): Promise<void> {
    this.conversations.set(tabId, conversation);
    await updateState((state) => bindConversation(state, tabId, conversation));
    await this.schedule(tabId);
  }

  async refreshTab(tabId: number): Promise<void> {
    this.cancel(tabId);
    try {
      const response = await chrome.tabs.sendMessage(tabId, { type: "get_conversation" }) as {
        conversation?: ConversationInfo | null;
      };
      if (response?.conversation) await this.noteConversation(tabId, response.conversation);
    } catch {
      // The active tab is not one of our supported AI pages.
    }
  }

  cancel(tabId: number): void {
    clearTimeout(this.timers.get(tabId));
    this.timers.delete(tabId);
    this.generations.set(tabId, (this.generations.get(tabId) ?? 0) + 1);
  }

  cancelAll(): void {
    for (const tabId of new Set([...this.timers.keys(), ...this.generations.keys()])) {
      this.cancel(tabId);
    }
  }

  forget(tabId: number): void {
    this.cancel(tabId);
    this.conversations.delete(tabId);
    this.generations.delete(tabId);
  }

  private async schedule(tabId: number): Promise<void> {
    this.cancel(tabId);
    const generation = this.generations.get(tabId)!;
    if (!await this.isAttended(tabId) || this.generations.get(tabId) !== generation) return;

    const timer = setTimeout(async () => {
      this.timers.delete(tabId);
      const conversation = this.conversations.get(tabId);
      if (
        conversation &&
        this.generations.get(tabId) === generation &&
        await this.isAttended(tabId)
      ) {
        await updateState((state) => removeConversation(state, conversation));
      }
    }, READ_DELAY_MS);
    this.timers.set(tabId, timer);
  }
}
