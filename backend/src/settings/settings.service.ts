import { Injectable, Inject } from '@nestjs/common';
import { DB_ADAPTER, IDbAdapter } from '../database/db.module';

export interface LlmSettings {
  provider: 'openai' | 'anthropic' | 'ollama';
  model: string;
  apiKey?: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AppSettings {
  llm: LlmSettings;
}

/**
 * Resolve the API key from env vars based on the active provider.
 */
function getEnvApiKey(provider: string): string | undefined {
  if (provider === 'openai') return process.env.OPENAI_API_KEY || undefined;
  if (provider === 'anthropic') return process.env.ANTHROPIC_API_KEY || undefined;
  return undefined;
}

function getDefaultSettings(): AppSettings {
  const provider = (process.env.LLM_PROVIDER as LlmSettings['provider']) || 'ollama';
  return {
    llm: {
      provider,
      model: process.env.LLM_MODEL || (process.env.OLLAMA_MODEL as string) || 'dolphin-llama3:8b',
      apiKey: getEnvApiKey(provider),
      baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
      temperature: process.env.LLM_TEMPERATURE ? parseFloat(process.env.LLM_TEMPERATURE) : 0.7,
      maxTokens: process.env.LLM_MAX_TOKENS ? parseInt(process.env.LLM_MAX_TOKENS, 10) : 1024,
    },
  };
}

const DEFAULT_SETTINGS = getDefaultSettings();

const SETTINGS_KEYS = {
  LLM_PROVIDER: 'llm.provider',
  LLM_MODEL: 'llm.model',
  LLM_API_KEY: 'llm.apiKey',
  LLM_BASE_URL: 'llm.baseUrl',
  LLM_TEMPERATURE: 'llm.temperature',
  LLM_MAX_TOKENS: 'llm.maxTokens',
};

@Injectable()
export class SettingsService {
  constructor(
    @Inject(DB_ADAPTER)
    private db: IDbAdapter,
  ) {}

  /**
   * Get all settings as a structured object.
   */
  async getAll(): Promise<AppSettings> {
    const dbSettings = await this.db.findAllSettings();
    const settingsMap = new Map(dbSettings.map((s) => [s.key, s.value]));

    return {
      llm: {
        provider: (settingsMap.get(SETTINGS_KEYS.LLM_PROVIDER) as LlmSettings['provider']) ||
          DEFAULT_SETTINGS.llm.provider,
        model: settingsMap.get(SETTINGS_KEYS.LLM_MODEL) || DEFAULT_SETTINGS.llm.model,
        apiKey: settingsMap.get(SETTINGS_KEYS.LLM_API_KEY) ||
          getEnvApiKey(
            (settingsMap.get(SETTINGS_KEYS.LLM_PROVIDER) as string) || DEFAULT_SETTINGS.llm.provider,
          ),
        baseUrl: settingsMap.get(SETTINGS_KEYS.LLM_BASE_URL) || DEFAULT_SETTINGS.llm.baseUrl,
        temperature: settingsMap.has(SETTINGS_KEYS.LLM_TEMPERATURE)
          ? parseFloat(settingsMap.get(SETTINGS_KEYS.LLM_TEMPERATURE)!)
          : DEFAULT_SETTINGS.llm.temperature,
        maxTokens: settingsMap.has(SETTINGS_KEYS.LLM_MAX_TOKENS)
          ? parseInt(settingsMap.get(SETTINGS_KEYS.LLM_MAX_TOKENS)!, 10)
          : DEFAULT_SETTINGS.llm.maxTokens,
      },
    };
  }

  /**
   * Get LLM settings.
   */
  async getLlmSettings(): Promise<LlmSettings> {
    const settings = await this.getAll();
    return settings.llm;
  }

  /**
   * Update LLM settings.
   */
  async updateLlmSettings(updates: Partial<LlmSettings>): Promise<LlmSettings> {
    if (updates.provider !== undefined) {
      await this.db.upsertSetting(SETTINGS_KEYS.LLM_PROVIDER, updates.provider);
    }
    if (updates.model !== undefined) {
      await this.db.upsertSetting(SETTINGS_KEYS.LLM_MODEL, updates.model);
    }
    if (updates.apiKey !== undefined) {
      await this.db.upsertSetting(SETTINGS_KEYS.LLM_API_KEY, updates.apiKey);
    }
    if (updates.baseUrl !== undefined) {
      await this.db.upsertSetting(SETTINGS_KEYS.LLM_BASE_URL, updates.baseUrl);
    }
    if (updates.temperature !== undefined) {
      await this.db.upsertSetting(SETTINGS_KEYS.LLM_TEMPERATURE, updates.temperature.toString());
    }
    if (updates.maxTokens !== undefined) {
      await this.db.upsertSetting(SETTINGS_KEYS.LLM_MAX_TOKENS, updates.maxTokens.toString());
    }

    return this.getLlmSettings();
  }

  /**
   * Get a single setting value.
   */
  async get(key: string): Promise<string | null> {
    const setting = await this.db.findSettingByKey(key);
    return setting?.value || null;
  }

  /**
   * Set a single setting value.
   */
  async set(key: string, value: string): Promise<void> {
    await this.db.upsertSetting(key, value);
  }

  /**
   * Delete a setting.
   */
  async delete(key: string): Promise<void> {
    await this.db.deleteSetting(key);
  }

  /**
   * Reset all settings to defaults.
   */
  async resetToDefaults(): Promise<AppSettings> {
    // Delete all llm settings
    for (const key of Object.values(SETTINGS_KEYS)) {
      await this.db.deleteSetting(key);
    }
    return DEFAULT_SETTINGS;
  }

  /**
   * Test LLM connection with current settings.
   */
  async testLlmConnection(): Promise<{ success: boolean; message: string; latencyMs?: number }> {
    const settings = await this.getLlmSettings();
    const startTime = Date.now();

    try {
      if (settings.provider === 'ollama') {
        const response = await fetch(`${settings.baseUrl}/api/tags`, {
          method: 'GET',
          signal: AbortSignal.timeout(5000),
        });

        if (!response.ok) {
          return {
            success: false,
            message: `Ollama server returned ${response.status}: ${response.statusText}`,
          };
        }

        const data = await response.json();
        const models = data.models?.map((m: { name: string }) => m.name) || [];

        return {
          success: true,
          message: `Connected to Ollama. Available models: ${models.slice(0, 5).join(', ')}${models.length > 5 ? '...' : ''}`,
          latencyMs: Date.now() - startTime,
        };
      } else if (settings.provider === 'openai') {
        if (!settings.apiKey) {
          return { success: false, message: 'OpenAI API key not configured' };
        }

        const response = await fetch('https://api.openai.com/v1/models', {
          method: 'GET',
          headers: { Authorization: `Bearer ${settings.apiKey}` },
          signal: AbortSignal.timeout(5000),
        });

        if (!response.ok) {
          return {
            success: false,
            message: `OpenAI API returned ${response.status}: ${response.statusText}`,
          };
        }

        return {
          success: true,
          message: 'Connected to OpenAI API',
          latencyMs: Date.now() - startTime,
        };
      } else if (settings.provider === 'anthropic') {
        if (!settings.apiKey) {
          return { success: false, message: 'Anthropic API key not configured' };
        }

        // Anthropic doesn't have a /models endpoint, so we just verify the key format
        if (!settings.apiKey.startsWith('sk-ant-')) {
          return { success: false, message: 'Invalid Anthropic API key format' };
        }

        return {
          success: true,
          message: 'Anthropic API key configured (format valid)',
          latencyMs: Date.now() - startTime,
        };
      }

      return { success: false, message: `Unknown provider: ${settings.provider}` };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  }
}
