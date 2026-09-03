import { useEffect, useState, type ReactNode } from "react";
import { STORAGE_KEY } from "../core/storage";
import type { AIInboxState, InboxItem, PendingTask } from "../core/types";

const providerName = { chatgpt: "ChatGPT", deepseek: "DeepSeek" } as const;

export function App() {
  const [state, setState] = useState<AIInboxState>({ pendingTasks: {}, inboxItems: {} });
  const pending = Object.values(state.pendingTasks).sort((a, b) => b.startedAt - a.startedAt);
  const unread = Object.values(state.inboxItems).sort((a, b) => b.completedAt - a.completedAt);
  const total = pending.length + unread.length;

  useEffect(() => {
    const show = (next?: AIInboxState) => {
      if (next) setState(next);
    };
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
        <span
          className="count"
          aria-label={`${pending.length} working and ${unread.length} unread conversations`}
        >
          {total}
        </span>
      </header>
      {total === 0 ? (
        <p className="empty">You're all caught up.</p>
      ) : (
        <>
          {pending.length > 0 && (
            <TaskSection title="Working" count={pending.length}>
              {pending.map((task) => (
                <PendingRow key={task.id} task={task} open={open} />
              ))}
            </TaskSection>
          )}
          {unread.length > 0 && (
            <TaskSection title="Unread" count={unread.length}>
              {unread.map((item) => (
                <UnreadRow key={item.id} item={item} open={open} dismiss={dismiss} />
              ))}
            </TaskSection>
          )}
        </>
      )}
    </main>
  );
}

function TaskSection({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section>
      <h2>{title} <span>{count}</span></h2>
      <ul>{children}</ul>
    </section>
  );
}

function PendingRow({ task, open }: { task: PendingTask; open(id: string): Promise<void> }) {
  return (
    <li>
      <button className="conversation" onClick={() => void open(task.id)}>
        <span className={`provider ${task.provider}`}>{providerName[task.provider]}</span>
        <strong>{task.latestPrompt || task.conversationTitle || "New conversation"}</strong>
        <span className="task-status working">
          <span className="spinner" aria-hidden="true" />
          Generating · {relativeTime(task.startedAt)}
        </span>
      </button>
    </li>
  );
}

function UnreadRow({
  item,
  open,
  dismiss,
}: {
  item: InboxItem;
  open(id: string): Promise<void>;
  dismiss(id: string): Promise<unknown>;
}) {
  const label = item.latestPrompt || item.conversationTitle || "conversation";
  return (
    <li>
      <button className="conversation" onClick={() => void open(item.id)}>
        <span className={`provider ${item.provider}`}>{providerName[item.provider]}</span>
        <strong>{label}</strong>
        <time dateTime={new Date(item.completedAt).toISOString()}>
          Completed · {completedAge(item.completedAt)}
        </time>
      </button>
      <button
        className="dismiss"
        aria-label={`Dismiss ${label}`}
        title="Dismiss"
        onClick={() => void dismiss(item.id)}
      >
        ×
      </button>
    </li>
  );
}

function completedAge(timestamp: number): string {
  const age = relativeTime(timestamp);
  return age === "now" ? "just now" : `${age} ago`;
}

function relativeTime(timestamp: number): string {
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}
