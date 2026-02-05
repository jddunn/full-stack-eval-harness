import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * LLM provider types supported by the harness.
 * Configured via LLM_PROVIDER env var.
 */
export type LlmProvider = 'openai' | 'anthropic' | 'ollama';

/**
 * Options for completion requests.
 */
export interface CompletionOptions {
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

/**
 * LLM service provides a unified interface for text completion and embeddings.
 * Uses Mastra under the hood but exposes a simple API.
 *
 * Supports OpenAI, Anthropic, and Ollama (local).
 */
@Injectable()
export class LlmService implements OnModuleInit {
  private provider: LlmProvider;
  private model: string;
  private apiKey: string | undefined;
  private baseUrl: string | undefined;

  constructor(private configService: ConfigService) {
    this.provider = (this.configService.get('LLM_PROVIDER') || 'openai') as LlmProvider;
    this.apiKey = this.configService.get('OPENAI_API_KEY');
    this.baseUrl = this.configService.get('OLLAMA_BASE_URL');
    this.model = this.configService.get('OLLAMA_MODEL') || 'dolphin-llama3:8b';
  }

  onModuleInit() {
    console.log(`LLM provider: ${this.provider}`);
    if (this.provider === 'ollama') {
      console.log(`Ollama URL: ${this.baseUrl || 'http://localhost:11434'}`);
      console.log(`Ollama model: ${this.model}`);
    }
  }

  /**
   * Generate a text completion using the configured provider.
   */
  async complete(prompt: string, options: CompletionOptions = {}): Promise<string> {
    const { temperature = 0.7, maxTokens = 1024, systemPrompt } = options;

    if (this.provider === 'ollama') {
      return this.completeOllama(prompt, { temperature, maxTokens, systemPrompt });
    } else if (this.provider === 'anthropic') {
      return this.completeAnthropic(prompt, { temperature, maxTokens, systemPrompt });
    } else {
      return this.completeOpenAI(prompt, { temperature, maxTokens, systemPrompt });
    }
  }

  /**
   * Generate embeddings for text. Used by semantic similarity grader.
   */
  async embed(text: string): Promise<number[]> {
    if (this.provider === 'ollama') {
      return this.embedOllama(text);
    } else {
      return this.embedOpenAI(text);
    }
  }

  // OpenAI implementation
  private async completeOpenAI(
    prompt: string,
    options: { temperature: number; maxTokens: number; systemPrompt?: string },
  ): Promise<string> {
    const messages: Array<{ role: string; content: string }> = [];
    if (options.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        temperature: options.temperature,
        max_tokens: options.maxTokens,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI error: ${error}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  private async embedOpenAI(text: string): Promise<number[]> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI embedding error: ${error}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  }

  // Anthropic implementation
  private async completeAnthropic(
    prompt: string,
    options: { temperature: number; maxTokens: number; systemPrompt?: string },
  ): Promise<string> {
    const anthropicKey = this.configService.get('ANTHROPIC_API_KEY');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: options.maxTokens,
        system: options.systemPrompt,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic error: ${error}`);
    }

    const data = await response.json();
    return data.content[0].text;
  }

  // Ollama implementation
  private async completeOllama(
    prompt: string,
    options: { temperature: number; maxTokens: number; systemPrompt?: string },
  ): Promise<string> {
    const baseUrl = this.baseUrl || 'http://localhost:11434';

    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt: options.systemPrompt ? `${options.systemPrompt}\n\n${prompt}` : prompt,
        stream: false,
        options: {
          temperature: options.temperature,
          num_predict: options.maxTokens,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama error: ${error}`);
    }

    const data = await response.json();
    return data.response;
  }

  private async embedOllama(text: string): Promise<number[]> {
    const baseUrl = this.baseUrl || 'http://localhost:11434';

    const response = await fetch(`${baseUrl}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt: text,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama embedding error: ${error}`);
    }

    const data = await response.json();
    return data.embedding;
  }
}
