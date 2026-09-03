import type { AIEvent } from "../adapters/types";
import { applyAIEvent } from "./state";
import { updateState } from "./storage";

export async function handleAIEvent(
  event: AIEvent,
  tabId: number,
  isAttended: (tabId: number) => Promise<boolean>,
): Promise<void> {
  const attended = event.type === "response_completed" && await isAttended(tabId);
  await updateState((state) => applyAIEvent(state, event, tabId, attended));
}
