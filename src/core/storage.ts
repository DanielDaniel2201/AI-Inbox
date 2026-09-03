import type { AIInboxState } from "./types";
import { emptyState } from "./state";

export const STORAGE_KEY = "aiInboxState";
const STORAGE_VERSION_KEY = "aiInboxStateVersion";
const STORAGE_VERSION = 2;
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
  const stored = await chrome.storage.local.get([STORAGE_KEY, STORAGE_VERSION_KEY]);
  const saved = stored[STORAGE_KEY] as Partial<AIInboxState> | undefined;
  if (stored[STORAGE_VERSION_KEY] === STORAGE_VERSION && saved) return readState();

  const state: AIInboxState = saved
    ? { pendingTasks: {}, inboxItems: saved.inboxItems ?? {} }
    : emptyState();
  await chrome.storage.local.set({
    [STORAGE_KEY]: state,
    [STORAGE_VERSION_KEY]: STORAGE_VERSION,
  });
  return state;
}
