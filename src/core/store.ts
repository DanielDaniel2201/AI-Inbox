import { emptyState } from "./state";
import type { AIInboxState } from "./types";

let state = emptyState();
const listeners = new Set<(state: AIInboxState) => void>();

export async function readState(): Promise<AIInboxState> {
  return state;
}

export async function updateState(
  change: (state: AIInboxState) => AIInboxState,
): Promise<AIInboxState> {
  const next = change(state);
  if (next !== state) {
    state = next;
    for (const listener of listeners) listener(state);
  }
  return state;
}

export function onStateChanged(listener: (state: AIInboxState) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
