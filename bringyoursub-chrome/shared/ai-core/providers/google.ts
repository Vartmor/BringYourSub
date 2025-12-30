/**
 * BringYourSub - Google Gemini Provider
 * 
 * Provider implementation for Google Gemini API.
 * Supports Gemini Pro, Gemini Flash models.
 * 
 * @module providers/google
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
        id: 'gemini-2.0-flash-exp',
        name: 'Gemini 2.0 Flash',
        provider: 'google',
        contextLength: 1000000,
        supportsVision: true,
        description: 'Latest and fastest Gemini model',
        pricing: { input: 0.075, output: 0.30 }
    },
    {
        id: 'gemini-1.5-pro',
        name: 'Gemini 1.5 Pro',
        provider: 'google',
        contextLength: 2000000,
        supportsVision: true,
        description: 'Most capable Gemini with 2M context',
        pricing: { input: 1.25, output: 5.00 }
    },
    {
        id: 'gemini-1.5-flash',
        name: 'Gemini 1.5 Flash',
        provider: 'google',
        contextLength: 1000000,
        supportsVision: true,
        description: 'Fast and efficient, great for most tasks',
        pricing: { input: 0.075, output: 0.30 }
    },
    {
        id: 'gemini-1.5-flash-8b',
        name: 'Gemini 1.5 Flash 8B',
        provider: 'google',
        contextLength: 1000000,
        supportsVision: true,
        description: 'Smallest and fastest, budget option',
        pricing: { input: 0.0375, output: 0.15 }
    }
];

const PROVIDER_CONFIG: ProviderConfig = {
    id: 'google',
    name: 'Google AI',
    description: 'Google Gemini models with massive context windows',
    website: 'https://aistudio.google.com',
    apiKeyPlaceholder: 'AIza...',
    apiKeyPrefix: 'AIza',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    requiresApiKey: true,
    isLocal: false,
    defaultModels: DEFAULT_MODELS
};

export class GoogleProvider implements AIProvider {
    readonly config = PROVIDER_CONFIG;

    async validateApiKey(apiKey: string): Promise<boolean> {
        if (!apiKey || !apiKey.startsWith('AIza')) {
            return false;
        }

        try {
            const response = await fetch(
                `${this.config.baseUrl}/models?key=${apiKey}`
            );
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
            const response = await fetch(
                `${this.config.baseUrl}/models?key=${apiKey}`
            );

            if (!response.ok) {
                return DEFAULT_MODELS;
            }

            const data = await response.json();
            const geminiModels = data.models
                ?.filter((m: any) =>
                    m.name.includes('gemini') &&
                    m.supportedGenerationMethods?.includes('generateContent')
                )
                .map((m: any) => {
                    const modelId = m.name.replace('models/', '');
                    const defaultModel = DEFAULT_MODELS.find(dm => dm.id === modelId);
                    return defaultModel || {
                        id: modelId,
                        name: m.displayName || modelId,
                        provider: 'google' as const,
                        contextLength: m.inputTokenLimit || 128000,
                        description: m.description
                    };
                }) || [];

            // Merge with defaults
            const modelIds = new Set(geminiModels.map((m: Model) => m.id));
            const merged = [...geminiModels];

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
            throw new Error('API key is required for Google AI');
        }

        // Convert to Gemini format
        const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
        let systemInstruction = options.systemPrompt || '';

        for (const msg of messages) {
            if (msg.role === 'system') {
                systemInstruction = msg.content + (systemInstruction ? '\n\n' + systemInstruction : '');
            } else {
                contents.push({
                    role: msg.role === 'assistant' ? 'model' : 'user',
                    parts: [{ text: msg.content }]
                });
            }
        }

        const body: any = {
            contents,
            generationConfig: {}
        };

        if (systemInstruction) {
            body.systemInstruction = { parts: [{ text: systemInstruction }] };
        }

        if (options.temperature !== undefined) {
            body.generationConfig.temperature = options.temperature;
        }

        if (options.maxTokens) {
            body.generationConfig.maxOutputTokens = options.maxTokens;
        }

        const response = await fetch(
            `${this.config.baseUrl}/models/${options.model}:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            }
        );

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error?.message || `Google AI error: ${response.status}`);
        }

        const data = await response.json();

        const content = data.candidates?.[0]?.content?.parts
            ?.map((p: any) => p.text)
            .join('') || '';

        return {
            content,
            model: options.model,
            usage: data.usageMetadata ? {
                promptTokens: data.usageMetadata.promptTokenCount || 0,
                completionTokens: data.usageMetadata.candidatesTokenCount || 0,
                totalTokens: data.usageMetadata.totalTokenCount || 0
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

export const googleProvider = new GoogleProvider();
