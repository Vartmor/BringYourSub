/**
 * BringYourSub - OpenAI Provider
 * 
 * Provider implementation for OpenAI API.
 * Supports GPT-4o, GPT-4o-mini, GPT-4 Turbo, GPT-3.5 Turbo, and o1 models.
 * 
 * @module providers/openai
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
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        provider: 'openai',
        contextLength: 128000,
        description: 'Fast and affordable, great for most tasks',
        pricing: { input: 0.15, output: 0.60 }
    },
    {
        id: 'gpt-4o',
        name: 'GPT-4o',
        provider: 'openai',
        contextLength: 128000,
        supportsVision: true,
        description: 'Most capable model, best quality',
        pricing: { input: 2.50, output: 10.00 }
    },
    {
        id: 'gpt-4-turbo',
        name: 'GPT-4 Turbo',
        provider: 'openai',
        contextLength: 128000,
        supportsVision: true,
        description: 'Previous generation, still very capable',
        pricing: { input: 10.00, output: 30.00 }
    },
    {
        id: 'gpt-3.5-turbo',
        name: 'GPT-3.5 Turbo',
        provider: 'openai',
        contextLength: 16385,
        description: 'Budget option, good for simple tasks',
        pricing: { input: 0.50, output: 1.50 }
    },
    {
        id: 'o1-mini',
        name: 'o1 Mini',
        provider: 'openai',
        contextLength: 128000,
        description: 'Reasoning model, great for complex problems',
        pricing: { input: 3.00, output: 12.00 }
    },
    {
        id: 'o1-preview',
        name: 'o1 Preview',
        provider: 'openai',
        contextLength: 128000,
        description: 'Advanced reasoning, best for complex analysis',
        pricing: { input: 15.00, output: 60.00 }
    }
];

const PROVIDER_CONFIG: ProviderConfig = {
    id: 'openai',
    name: 'OpenAI',
    description: 'OpenAI GPT models including GPT-4o and o1',
    website: 'https://platform.openai.com',
    apiKeyPlaceholder: 'sk-...',
    apiKeyPrefix: 'sk-',
    baseUrl: 'https://api.openai.com/v1',
    requiresApiKey: true,
    isLocal: false,
    defaultModels: DEFAULT_MODELS
};

export class OpenAIProvider implements AIProvider {
    readonly config = PROVIDER_CONFIG;

    async validateApiKey(apiKey: string): Promise<boolean> {
        if (!apiKey || !apiKey.startsWith('sk-')) {
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
            const gptModels = data.data
                .filter((m: any) =>
                    m.id.includes('gpt') ||
                    m.id.includes('o1')
                )
                .map((m: any) => {
                    // Find in defaults for pricing info, or create new
                    const defaultModel = DEFAULT_MODELS.find(dm => dm.id === m.id);
                    return defaultModel || {
                        id: m.id,
                        name: m.id,
                        provider: 'openai' as const,
                        contextLength: 128000
                    };
                });

            // Merge with defaults to ensure we have all known models
            const modelIds = new Set(gptModels.map((m: Model) => m.id));
            const merged = [...gptModels];

            for (const defaultModel of DEFAULT_MODELS) {
                if (!modelIds.has(defaultModel.id)) {
                    merged.push(defaultModel);
                }
            }

            return merged.sort((a, b) => {
                // Sort by preference: gpt-4o-mini first, then gpt-4o, etc.
                const order = ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'o1-mini', 'o1-preview', 'gpt-3.5-turbo'];
                const aIndex = order.indexOf(a.id);
                const bIndex = order.indexOf(b.id);
                if (aIndex === -1 && bIndex === -1) return a.id.localeCompare(b.id);
                if (aIndex === -1) return 1;
                if (bIndex === -1) return -1;
                return aIndex - bIndex;
            });
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
            throw new Error('API key is required for OpenAI');
        }

        const isO1Model = options.model.startsWith('o1');

        // o1 models don't support system messages, convert to user message
        let processedMessages = messages;
        if (isO1Model) {
            processedMessages = messages.map(m =>
                m.role === 'system'
                    ? { role: 'user' as const, content: `[System Instructions]\n${m.content}` }
                    : m
            );
        }

        const body: any = {
            model: options.model,
            messages: processedMessages
        };

        // o1 models don't support temperature
        if (!isO1Model && options.temperature !== undefined) {
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
            throw new Error(error.error?.message || `OpenAI API error: ${response.status}`);
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

export const openaiProvider = new OpenAIProvider();
