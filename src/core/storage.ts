import type { AIInboxState } from "./types";
import { emptyState } from "./state";

export const STORAGE_KEY = "aiInboxState";
let queue: Promise<unknown> = Promise.resolve();

export async function readState(): Promise<AIInboxState> {
  const value = (await chrome.storage.local.get(STORAGE_KEY))[STORAGE_KEY] as
    | Partial<AIInboxState>
    | undefined;
  return {
    pendingTasks: value?.pendingTasks ?? {},
    inboxItems: value?.inboxItems ?? {},
  };
}

export function updateState(
  change: (state: AIInboxState) => AIInboxState,
): Promise<AIInboxState> {
  const update = queue.then(async () => {
    const current = await readState();
    const next = change(current);
    if (next !== current) await chrome.storage.local.set({ [STORAGE_KEY]: next });
    return next;
  });
  queue = update.catch(() => undefined);
  return update;
}

export async function initializeState(): Promise<AIInboxState> {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  if (stored[STORAGE_KEY]) return readState();
  const state = emptyState();
  await chrome.storage.local.set({ [STORAGE_KEY]: state });
  return state;
}
