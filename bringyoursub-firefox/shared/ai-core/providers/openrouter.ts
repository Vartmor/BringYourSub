/**
 * BringYourSub - OpenRouter Provider
 * 
 * Provider implementation for OpenRouter API.
 * Unified gateway to 100+ AI models from various providers.
 * 
 * @module providers/openrouter
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
        id: 'openai/gpt-4o-mini',
        name: 'GPT-4o Mini (via OpenRouter)',
        provider: 'openrouter',
        contextLength: 128000,
        description: 'OpenAI GPT-4o Mini through OpenRouter',
        pricing: { input: 0.15, output: 0.60 }
    },
    {
        id: 'anthropic/claude-3.5-sonnet',
        name: 'Claude 3.5 Sonnet (via OpenRouter)',
        provider: 'openrouter',
        contextLength: 200000,
        description: 'Anthropic Claude through OpenRouter',
        pricing: { input: 3.00, output: 15.00 }
    },
    {
        id: 'google/gemini-pro-1.5',
        name: 'Gemini 1.5 Pro (via OpenRouter)',
        provider: 'openrouter',
        contextLength: 1000000,
        description: 'Google Gemini through OpenRouter',
        pricing: { input: 1.25, output: 5.00 }
    },
    {
        id: 'meta-llama/llama-3.3-70b-instruct',
        name: 'Llama 3.3 70B',
        provider: 'openrouter',
        contextLength: 128000,
        description: 'Latest Llama model',
        pricing: { input: 0.40, output: 0.40 }
    },
    {
        id: 'deepseek/deepseek-chat',
        name: 'DeepSeek Chat',
        provider: 'openrouter',
        contextLength: 64000,
        description: 'DeepSeek conversational model',
        pricing: { input: 0.14, output: 0.28 }
    },
    {
        id: 'qwen/qwen-2.5-72b-instruct',
        name: 'Qwen 2.5 72B',
        provider: 'openrouter',
        contextLength: 128000,
        description: 'Alibaba Qwen model',
        pricing: { input: 0.35, output: 0.40 }
    }
];

const PROVIDER_CONFIG: ProviderConfig = {
    id: 'openrouter',
    name: 'OpenRouter',
    description: 'Access 100+ AI models through one API',
    website: 'https://openrouter.ai',
    apiKeyPlaceholder: 'sk-or-...',
    apiKeyPrefix: 'sk-or-',
    baseUrl: 'https://openrouter.ai/api/v1',
    requiresApiKey: true,
    isLocal: false,
    defaultModels: DEFAULT_MODELS
};

export class OpenRouterProvider implements AIProvider {
    readonly config = PROVIDER_CONFIG;

    async validateApiKey(apiKey: string): Promise<boolean> {
        if (!apiKey) {
            return false;
        }

        try {
            const response = await fetch(`${this.config.baseUrl}/auth/key`, {
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
        try {
            const headers: HeadersInit = {};
            if (apiKey) {
                headers['Authorization'] = `Bearer ${apiKey}`;
            }

            const response = await fetch(`${this.config.baseUrl}/models`, { headers });

            if (!response.ok) {
                return DEFAULT_MODELS;
            }

            const data = await response.json();

            // Get top models for translation tasks
            const preferredProviders = ['openai', 'anthropic', 'google', 'meta-llama', 'deepseek', 'qwen'];

            const models = data.data
                ?.filter((m: any) =>
                    preferredProviders.some(p => m.id.startsWith(p + '/')) &&
                    m.context_length >= 8000
                )
                .slice(0, 20)
                .map((m: any) => ({
                    id: m.id,
                    name: m.name || m.id,
                    provider: 'openrouter' as const,
                    contextLength: m.context_length || 8192,
                    pricing: m.pricing ? {
                        input: parseFloat(m.pricing.prompt) * 1000000,
                        output: parseFloat(m.pricing.completion) * 1000000
                    } : undefined
                })) || [];

            return models.length > 0 ? models : DEFAULT_MODELS;
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
            throw new Error('API key is required for OpenRouter');
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
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': 'https://github.com/Vartmor/BringYourSub',
                'X-Title': 'BringYourSub'
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error?.message || `OpenRouter API error: ${response.status}`);
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

export const openrouterProvider = new OpenRouterProvider();
