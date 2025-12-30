/**
 * BringYourSub - Anthropic Provider
 * 
 * Provider implementation for Anthropic Claude API.
 * Supports Claude 3.5 Sonnet, Claude 3 Opus, Claude 3 Haiku.
 * 
 * @module providers/anthropic
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
        id: 'claude-3-5-sonnet-latest',
        name: 'Claude 3.5 Sonnet',
        provider: 'anthropic',
        contextLength: 200000,
        supportsVision: true,
        description: 'Most intelligent model, best for complex tasks',
        pricing: { input: 3.00, output: 15.00 }
    },
    {
        id: 'claude-3-5-haiku-latest',
        name: 'Claude 3.5 Haiku',
        provider: 'anthropic',
        contextLength: 200000,
        supportsVision: true,
        description: 'Fast and affordable, great for quick tasks',
        pricing: { input: 0.80, output: 4.00 }
    },
    {
        id: 'claude-3-opus-latest',
        name: 'Claude 3 Opus',
        provider: 'anthropic',
        contextLength: 200000,
        supportsVision: true,
        description: 'Previous top model, still very capable',
        pricing: { input: 15.00, output: 75.00 }
    },
    {
        id: 'claude-3-sonnet-20240229',
        name: 'Claude 3 Sonnet',
        provider: 'anthropic',
        contextLength: 200000,
        supportsVision: true,
        description: 'Balanced performance and cost',
        pricing: { input: 3.00, output: 15.00 }
    },
    {
        id: 'claude-3-haiku-20240307',
        name: 'Claude 3 Haiku',
        provider: 'anthropic',
        contextLength: 200000,
        supportsVision: true,
        description: 'Fastest response time',
        pricing: { input: 0.25, output: 1.25 }
    }
];

const PROVIDER_CONFIG: ProviderConfig = {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Claude AI models with excellent reasoning',
    website: 'https://console.anthropic.com',
    apiKeyPlaceholder: 'sk-ant-...',
    apiKeyPrefix: 'sk-ant-',
    baseUrl: 'https://api.anthropic.com/v1',
    requiresApiKey: true,
    isLocal: false,
    defaultModels: DEFAULT_MODELS
};

export class AnthropicProvider implements AIProvider {
    readonly config = PROVIDER_CONFIG;
    private readonly apiVersion = '2023-06-01';

    async validateApiKey(apiKey: string): Promise<boolean> {
        if (!apiKey || !apiKey.startsWith('sk-ant-')) {
            return false;
        }

        try {
            // Anthropic doesn't have a models endpoint, so we make a minimal request
            const response = await fetch(`${this.config.baseUrl}/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': this.apiVersion
                },
                body: JSON.stringify({
                    model: 'claude-3-5-haiku-latest',
                    max_tokens: 1,
                    messages: [{ role: 'user', content: 'Hi' }]
                })
            });

            // Both 200 and 400 (invalid request) indicate valid API key
            // Only 401 means invalid key
            return response.status !== 401;
        } catch {
            return false;
        }
    }

    async getModels(_apiKey?: string): Promise<Model[]> {
        // Anthropic doesn't have a models API, return static list
        return DEFAULT_MODELS;
    }

    async chat(
        messages: ChatMessage[],
        options: ChatOptions,
        apiKey?: string
    ): Promise<ChatResponse> {
        if (!apiKey) {
            throw new Error('API key is required for Anthropic');
        }

        // Anthropic uses a different message format
        // System message goes in a separate field
        let systemPrompt = options.systemPrompt || '';
        const anthropicMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

        for (const msg of messages) {
            if (msg.role === 'system') {
                systemPrompt = msg.content + (systemPrompt ? '\n\n' + systemPrompt : '');
            } else {
                anthropicMessages.push({
                    role: msg.role as 'user' | 'assistant',
                    content: msg.content
                });
            }
        }

        const body: any = {
            model: options.model,
            max_tokens: options.maxTokens || 4096,
            messages: anthropicMessages
        };

        if (systemPrompt) {
            body.system = systemPrompt;
        }

        if (options.temperature !== undefined) {
            body.temperature = options.temperature;
        }

        const response = await fetch(`${this.config.baseUrl}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': this.apiVersion
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error?.message || `Anthropic API error: ${response.status}`);
        }

        const data = await response.json();

        // Anthropic returns content as an array of blocks
        const content = data.content
            .filter((block: any) => block.type === 'text')
            .map((block: any) => block.text)
            .join('');

        return {
            content,
            model: data.model,
            usage: data.usage ? {
                promptTokens: data.usage.input_tokens,
                completionTokens: data.usage.output_tokens,
                totalTokens: data.usage.input_tokens + data.usage.output_tokens
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
                modelsLoaded: true // Static models, always loaded
            };
        } catch (e) {
            return {
                available: false,
                error: e instanceof Error ? e.message : 'Connection failed'
            };
        }
    }
}

export const anthropicProvider = new AnthropicProvider();
