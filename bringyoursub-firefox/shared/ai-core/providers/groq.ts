/**
 * BringYourSub - Groq Provider
 * 
 * Provider implementation for Groq API.
 * OpenAI-compatible API with Llama, Mixtral models.
 * Known for extremely fast inference.
 * 
 * @module providers/groq
 */

import type {
    AIProvider,
    ProviderConfig,
    Model,
    ChatMessage,
    ChatOptions,
    ChatResponse,
    ProviderStatus
} from './types';

const DEFAULT_MODELS: Model[] = [
    {
        id: 'llama-3.3-70b-versatile',
        name: 'Llama 3.3 70B',
        provider: 'groq',
        contextLength: 128000,
        description: 'Latest Llama model, excellent performance',
        pricing: { input: 0.59, output: 0.79 }
    },
    {
        id: 'llama-3.1-70b-versatile',
        name: 'Llama 3.1 70B',
        provider: 'groq',
        contextLength: 128000,
        description: 'Very capable open source model',
        pricing: { input: 0.59, output: 0.79 }
    },
    {
        id: 'llama-3.1-8b-instant',
        name: 'Llama 3.1 8B',
        provider: 'groq',
        contextLength: 128000,
        description: 'Fast and efficient, great for simple tasks',
        pricing: { input: 0.05, output: 0.08 }
    },
    {
        id: 'mixtral-8x7b-32768',
        name: 'Mixtral 8x7B',
        provider: 'groq',
        contextLength: 32768,
        description: 'Mixture of experts, good for diverse tasks',
        pricing: { input: 0.24, output: 0.24 }
    },
    {
        id: 'gemma2-9b-it',
        name: 'Gemma 2 9B',
        provider: 'groq',
        contextLength: 8192,
        description: 'Google Gemma model, balanced performance',
        pricing: { input: 0.20, output: 0.20 }
    }
];

const PROVIDER_CONFIG: ProviderConfig = {
    id: 'groq',
    name: 'Groq',
    description: 'Ultra-fast inference with open source models',
    website: 'https://console.groq.com',
    apiKeyPlaceholder: 'gsk_...',
    apiKeyPrefix: 'gsk_',
    baseUrl: 'https://api.groq.com/openai/v1',
    requiresApiKey: true,
    isLocal: false,
    defaultModels: DEFAULT_MODELS
};

export class GroqProvider implements AIProvider {
    readonly config = PROVIDER_CONFIG;

    async validateApiKey(apiKey: string): Promise<boolean> {
        if (!apiKey || !apiKey.startsWith('gsk_')) {
            return false;
        }

        try {
            const response = await fetch(`${this.config.baseUrl}/models`, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`
                }
            });
            return response.ok;
        } catch {
            return false;
        }
    }

    async getModels(apiKey?: string): Promise<Model[]> {
        if (!apiKey) {
            return DEFAULT_MODELS;
        }

        try {
            const response = await fetch(`${this.config.baseUrl}/models`, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`
                }
            });

            if (!response.ok) {
                return DEFAULT_MODELS;
            }

            const data = await response.json();
            const models = data.data
                ?.filter((m: any) => m.active !== false)
                .map((m: any) => {
                    const defaultModel = DEFAULT_MODELS.find(dm => dm.id === m.id);
                    return defaultModel || {
                        id: m.id,
                        name: m.id,
                        provider: 'groq' as const,
                        contextLength: m.context_window || 8192
                    };
                }) || [];

            // Merge with defaults
            const modelIds = new Set(models.map((m: Model) => m.id));
            const merged = [...models];

            for (const defaultModel of DEFAULT_MODELS) {
                if (!modelIds.has(defaultModel.id)) {
                    merged.push(defaultModel);
                }
            }

            return merged;
        } catch {
            return DEFAULT_MODELS;
        }
    }

    async chat(
        messages: ChatMessage[],
        options: ChatOptions,
        apiKey?: string
    ): Promise<ChatResponse> {
        if (!apiKey) {
            throw new Error('API key is required for Groq');
        }

        const body: any = {
            model: options.model,
            messages
        };

        if (options.temperature !== undefined) {
            body.temperature = options.temperature;
        }

        if (options.maxTokens) {
            body.max_tokens = options.maxTokens;
        }

        const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error?.message || `Groq API error: ${response.status}`);
        }

        const data = await response.json();

        return {
            content: data.choices[0]?.message?.content || '',
            model: data.model,
            usage: data.usage ? {
                promptTokens: data.usage.prompt_tokens,
                completionTokens: data.usage.completion_tokens,
                totalTokens: data.usage.total_tokens
            } : undefined
        };
    }

    async checkStatus(apiKey?: string): Promise<ProviderStatus> {
        if (!apiKey) {
            return { available: false, error: 'API key required' };
        }

        try {
            const isValid = await this.validateApiKey(apiKey);
            return {
                available: isValid,
                error: isValid ? undefined : 'Invalid API key',
                modelsLoaded: isValid
            };
        } catch (e) {
            return {
                available: false,
                error: e instanceof Error ? e.message : 'Connection failed'
            };
        }
    }
}

export const groqProvider = new GroqProvider();
