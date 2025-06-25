import { AiSettings } from '@/types/ai-settings';
import { BuildResult } from '@/features/ai-agents/types/factoryAdapter';
import { ChatCompletionMessage } from '@/features/ai-provider/sources/types';
import { MessageRole } from '@/features/chat/types/message';

export type MessageContent = string | { type: string; text: string }[];
export type MessageType = 'user' | 'assistant' | 'system' | 'memory';

export interface Message {
  role: MessageType;
  content: MessageContent;
}

export interface CompletionResponse {
  text: string;
  raw?: any;
}

export interface ChatMessage {
  content: string;
  role: MessageType;
}

export interface ChatResponse {
  message: ChatMessage;
  raw?: any;
}

export interface CompletionParams {
  prompt: string | { type: string; text: string }[];
  stream?: boolean;
}

export interface ChatParams {
  messages: Message[];
  stream?: boolean;
}

export class AiFactoryCompletionAdapter {
  constructor(
    private readonly ai: BuildResult,
    private readonly settings: Omit<AiSettings, 'model'> = {
      randomness: 0.0,
      repetitiveness: 1,
      bestOf: 1,
      frequencyPenalty: 0,
      presencePenalty: 0,
    }
  ) {}

  get metadata() {
    return {
      model: this.ai.model.externalId,
      temperature: this.settings.randomness || 0,
      topP: 1,
      contextWindow: 4096,
    };
  }

  /**
   * Handles text completion requests
   */
  async complete(params: CompletionParams): Promise<CompletionResponse> {
    // Stream not supported yet
    if (params.stream) {
      throw new Error('Streaming not implemented');
    }

    let promptText: string;
    if (typeof params.prompt === 'string') {
      promptText = params.prompt;
    } else {
      promptText = params.prompt[0].type === 'text' ? params.prompt[0].text : '';
    }
    
    const response = await this.ai.source.completion(promptText, {
      ...this.settings,
      model: this.ai.model.externalId,
    });

    return {
      text: response.text,
      raw: response,
    };
  }

  /**
   * Handles chat format requests
   */
  async chat(params: ChatParams): Promise<ChatResponse> {
    if (params.stream) {
      throw new Error('Streaming not implemented');
    }

    const prompt: ChatCompletionMessage[] = params.messages
      .map((msg) => {
        let content = '';

        switch (typeof msg.content) {
          case 'string':
            content = msg.content;
            break;
          case 'object':
            if (msg.content[0].type === 'text') {
              content = msg.content[0].text;
            }
            break;
        }

        return {
          role: this.castRole(msg.role),
          content,
        };
      });

    const response = await this.ai.source.chatCompletion(prompt, {
      ...this.settings,
      model: this.ai.model.externalId,
    });

    return {
      message: {
        content: response.text,
        role: 'assistant',
      },
      raw: response,
    };
  }

  /**
   * Convert message role to our internal format
   */
  private castRole(role: MessageType): MessageRole {
    switch (role) {
      case 'user':
      case 'memory':
        return MessageRole.User;
      case 'assistant':
        return MessageRole.Assistant;
      case 'system':
        return MessageRole.System;
      default:
        throw new Error('Unsupported role provided');
    }
  }
}
