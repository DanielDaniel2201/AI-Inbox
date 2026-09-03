import { useEffect, useState } from "react";
import { STORAGE_KEY } from "../core/storage";
import type { AIInboxState, InboxItem } from "../core/types";

const providerName = { chatgpt: "ChatGPT", deepseek: "DeepSeek" } as const;

export function App() {
  const [items, setItems] = useState<InboxItem[]>([]);

  useEffect(() => {
    const show = (state?: AIInboxState) => setItems(
      Object.values(state?.inboxItems ?? {}).sort((a, b) => b.completedAt - a.completedAt),
    );
    void chrome.storage.local.get(STORAGE_KEY).then((result) =>
      show(result[STORAGE_KEY] as AIInboxState | undefined),
    );
    const onChanged = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === "local" && changes[STORAGE_KEY]) {
        show(changes[STORAGE_KEY].newValue as AIInboxState | undefined);
      }
    };
    chrome.storage.onChanged.addListener(onChanged);
    return () => chrome.storage.onChanged.removeListener(onChanged);
  }, []);

  const open = async (id: string) => {
    await chrome.runtime.sendMessage({ type: "open_item", id });
    window.close();
  };
  const dismiss = (id: string) => chrome.runtime.sendMessage({ type: "dismiss_item", id });

  return (
    <main>
      <header>
        <h1>AI Inbox</h1>
        <span className="count" aria-label={`${items.length} unread conversations`}>
          {items.length}
        </span>
      </header>
      {items.length === 0 ? (
        <p className="empty">You're all caught up.</p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              <button className="conversation" onClick={() => void open(item.id)}>
                <span className={`provider ${item.provider}`}>{providerName[item.provider]}</span>
                <strong>{item.conversationTitle || "Untitled conversation"}</strong>
                <time dateTime={new Date(item.completedAt).toISOString()}>
                  {relativeTime(item.completedAt)}
                </time>
              </button>
              <button
                className="dismiss"
                aria-label={`Dismiss ${item.conversationTitle || "conversation"}`}
                title="Dismiss"
                onClick={() => void dismiss(item.id)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function relativeTime(timestamp: number): string {
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}
