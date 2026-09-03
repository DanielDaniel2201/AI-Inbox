import assert from "node:assert/strict";
import test from "node:test";
import type { ConversationInfo } from "../adapters/types.ts";
import {
  applyAIEvent,
  bindConversation,
  clearPendingForTab,
  detachTab,
  emptyState,
  removeConversation,
} from "./state.ts";

const conversation: ConversationInfo = {
  provider: "chatgpt",
  conversationId: "abc",
  title: "Plan",
  url: "https://chatgpt.com/c/abc",
};

test("conversation lifecycle and tab persistence", () => {
  let state = applyAIEvent(
    emptyState(),
    { type: "prompt_submitted", conversation, prompt: "How should I move?" },
    7,
    false,
    100,
  );
  assert.equal(Object.keys(state.pendingTasks).length, 1);
  assert.equal(state.pendingTasks["chatgpt:abc"].latestPrompt, "How should I move?");

  state = applyAIEvent(
    state,
    { type: "response_completed", conversation },
    7,
    false,
    200,
  );
  assert.equal(Object.keys(state.pendingTasks).length, 0);
  assert.equal(state.inboxItems["chatgpt:abc"].completedAt, 200);
  assert.equal(state.inboxItems["chatgpt:abc"].latestPrompt, "How should I move?");

  state = detachTab(state, 7);
  assert.equal(state.inboxItems["chatgpt:abc"].tabId, undefined);
  state = bindConversation(state, 9, conversation);
  assert.equal(state.inboxItems["chatgpt:abc"].tabId, 9);
  state = removeConversation(state, conversation);
  assert.equal(Object.keys(state.inboxItems).length, 0);
});

test("page reload clears stale pending work for that tab", () => {
  const state = applyAIEvent(
    emptyState(),
    { type: "prompt_submitted", conversation, prompt: "old prompt" },
    7,
    false,
  );
  assert.equal(Object.keys(clearPendingForTab(state, 7).pendingTasks).length, 0);
  assert.equal(Object.keys(clearPendingForTab(state, 8).pendingTasks).length, 1);
});

test("a focused completion never enters the inbox", () => {
  const state = applyAIEvent(
    emptyState(),
    { type: "response_completed", conversation },
    7,
    true,
  );
  assert.equal(Object.keys(state.inboxItems).length, 0);
});

test("later replies replace the conversation item", () => {
  let state = applyAIEvent(
    emptyState(),
    { type: "response_completed", conversation, preview: "first" },
    7,
    false,
    100,
  );
  state = applyAIEvent(
    state,
    { type: "response_completed", conversation, preview: "second" },
    7,
    false,
    300,
  );
  assert.equal(Object.keys(state.inboxItems).length, 1);
  assert.equal(state.inboxItems["chatgpt:abc"].preview, "second");
  assert.equal(state.inboxItems["chatgpt:abc"].completedAt, 300);
});
