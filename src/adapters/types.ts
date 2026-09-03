export type Provider = "chatgpt" | "deepseek";

export interface ConversationInfo {
  provider: Provider;
  conversationId: string;
  title?: string;
  url: string;
}

export type AIEvent =
  | { type: "prompt_submitted"; conversation: ConversationInfo }
  | { type: "response_started"; conversation: ConversationInfo }
  | {
      type: "response_completed";
      conversation: ConversationInfo;
      preview?: string;
    };

export interface AIAdapter {
  id: Provider;
  match(url: string): boolean;
  getConversation(): ConversationInfo | null;
  observe(emit: (event: AIEvent) => void): () => void;
}
