import { useEffect, useState } from "react";
import { STORAGE_KEY } from "../core/storage";
import type { AIInboxState, InboxItem, PendingTask } from "../core/types";

const providerName = { chatgpt: "ChatGPT", deepseek: "DeepSeek" } as const;
type Task =
  | { kind: "working"; value: PendingTask }
  | { kind: "unread"; value: InboxItem };

export function App() {
  const [state, setState] = useState<AIInboxState>({ pendingTasks: {}, inboxItems: {} });
  const pending = Object.values(state.pendingTasks).sort((a, b) => b.startedAt - a.startedAt);
  const unread = Object.values(state.inboxItems);
  const tasks: Task[] = [
    ...pending.map((value): Task => ({ kind: "working", value })),
    ...unread
      .sort((a, b) => b.completedAt - a.completedAt)
      .map((value): Task => ({ kind: "unread", value })),
  ];

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
  if (tasks.length === 0) return null;
  return (
    <main>
      <ul>
        {tasks.map((task) => (
          <TaskRow key={`${task.kind}:${task.value.id}`} task={task} open={open} />
        ))}
      </ul>
    </main>
  );
}

function TaskRow({ task, open }: { task: Task; open(id: string): Promise<void> }) {
  const { value } = task;
  const label = value.latestPrompt || value.conversationTitle || "New conversation";
  return (
    <li>
      <button className="conversation" onClick={() => void open(value.id)}>
        <img
          className="provider-logo"
          src={`icons/${value.provider}.png`}
          alt={providerName[value.provider]}
          title={providerName[value.provider]}
        />
        <strong title={label}>{label}</strong>
        {task.kind === "working" ? (
          <span className="spinner" aria-label="Generating" />
        ) : (
          <time dateTime={new Date(task.value.completedAt).toISOString()}>
            {relativeTime(task.value.completedAt)}
          </time>
        )}
      </button>
    </li>
  );
}

function relativeTime(timestamp: number): string {
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return days < 30 ? `${days}d` : `${Math.floor(days / 30)}mo`;
}
