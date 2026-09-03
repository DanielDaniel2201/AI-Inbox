import type { AIAdapter, AIEvent, ConversationInfo, Provider } from "./types";

interface DOMAdapterConfig {
  id: Provider;
  hosts: string[];
  conversation(): ConversationInfo | null;
  assistantSelector: string;
  promptSelector: string;
  sendSelector: string;
  stopSelector: string;
  fallbackIdleMs?: number;
}

const isVisible = (element: HTMLElement) =>
  element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden";
const exists = (selector: string) =>
  Array.from(document.querySelectorAll<HTMLElement>(selector)).some(isVisible);

export function createDOMAdapter(config: DOMAdapterConfig): AIAdapter {
  return {
    id: config.id,
    match(url) {
      try {
        return config.hosts.includes(new URL(url).hostname);
      } catch {
        return false;
      }
    },
    getConversation: config.conversation,
    observe(emit) {
      let generating = exists(config.stopSelector);
      let pending = generating;
      let assistantAtPrompt = lastAssistantText(config.assistantSelector);
      let idleTimer: ReturnType<typeof setTimeout> | undefined;
      let waitingPrompt = "";

      const conversation = () => config.conversation();
      const emitPrompt = (value = promptText(config.promptSelector)) => {
        const prompt = value.trim().slice(0, 240);
        if (pending || !prompt) return;
        const current = conversation();
        if (!current) {
          waitingPrompt = prompt;
          return;
        }
        pending = true;
        waitingPrompt = "";
        assistantAtPrompt = lastAssistantText(config.assistantSelector);
        emit({ type: "prompt_submitted", conversation: current, prompt });
      };
      const complete = () => {
        const current = conversation();
        if (!current || !pending) return;
        pending = false;
        clearTimeout(idleTimer);
        const preview = lastAssistantText(config.assistantSelector);
        emit({
          type: "response_completed",
          conversation: current,
          ...(preview ? { preview: preview.slice(0, 180) } : {}),
        });
      };
      const scheduleFallback = () => {
        if (!config.fallbackIdleMs || !pending || generating) return;
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
          if (
            !exists(config.stopSelector) &&
            lastAssistantText(config.assistantSelector) !== assistantAtPrompt
          ) {
            complete();
          }
        }, config.fallbackIdleMs);
      };
      const evaluate = () => {
        if (waitingPrompt && !pending) emitPrompt(waitingPrompt);

        const nextGenerating = exists(config.stopSelector);
        if (nextGenerating && !generating) {
          generating = true;
          clearTimeout(idleTimer);
          const current = conversation();
          if (pending && current) emit({ type: "response_started", conversation: current });
        } else if (!nextGenerating && generating) {
          generating = false;
          complete();
        } else {
          scheduleFallback();
        }
      };
      const onSubmit = (event: Event) => {
        const form = event.target as HTMLFormElement;
        if (form.querySelector?.(config.promptSelector)) emitPrompt();
      };
      const onKeyDown = (event: KeyboardEvent) => {
        if (
          event.key === "Enter" &&
          !event.shiftKey &&
          !event.isComposing &&
          (event.target as Element)?.matches?.(config.promptSelector)
        ) {
          emitPrompt();
        }
      };
      const onClick = (event: MouseEvent) => {
        if ((event.target as Element)?.closest?.(config.sendSelector)) {
          emitPrompt();
        }
      };

      document.addEventListener("submit", onSubmit, true);
      document.addEventListener("keydown", onKeyDown, true);
      document.addEventListener("click", onClick, true);
      // MutationObserver still runs in background tabs; requestAnimationFrame does not.
      const observer = new MutationObserver(evaluate);
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });

      return () => {
        document.removeEventListener("submit", onSubmit, true);
        document.removeEventListener("keydown", onKeyDown, true);
        document.removeEventListener("click", onClick, true);
        observer.disconnect();
        clearTimeout(idleTimer);
      };
    },
  };
}

function lastAssistantText(selector: string): string {
  const elements = document.querySelectorAll<HTMLElement>(selector);
  return elements.item(elements.length - 1)?.innerText.trim() ?? "";
}

function promptText(selector: string): string {
  const element = Array.from(document.querySelectorAll<HTMLElement>(selector)).find(isVisible);
  const text = element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement
    ? element.value
    : element?.innerText;
  return text?.trim().slice(0, 240) ?? "";
}
