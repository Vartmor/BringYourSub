/**
 * BringYourSub - LM Studio Provider
 * 
 * Provider implementation for LM Studio local server.
 * Runs local models on user's machine via OpenAI-compatible API.
 * 
 * @module providers/lmstudio
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
        id: 'local-model',
        name: 'Local Model (LM Studio)',
        provider: 'lmstudio',
        contextLength: 8192,
        description: 'Start LM Studio and load a model to see available models'
    }
];

const PROVIDER_CONFIG: ProviderConfig = {
    id: 'lmstudio',
    name: 'LM Studio',
    description: 'Run local AI models on your computer',
    website: 'https://lmstudio.ai',
    apiKeyPlaceholder: 'Not required',
    apiKeyPrefix: '',
    baseUrl: 'http://localhost:1234/v1',
    requiresApiKey: false,
    isLocal: true,
    defaultModels: DEFAULT_MODELS
};

export class LMStudioProvider implements AIProvider {
    readonly config = PROVIDER_CONFIG;

    async validateApiKey(_apiKey: string): Promise<boolean> {
        // LM Studio doesn't require an API key
        // Instead, check if the server is running
        return this.isServerRunning();
    }

    private async isServerRunning(): Promise<boolean> {
        try {
            const response = await fetch(`${this.config.baseUrl}/models`, {
                signal: AbortSignal.timeout(3000)
            });
            return response.ok;
        } catch {
            return false;
        }
    }

    async getModels(_apiKey?: string): Promise<Model[]> {
        try {
            const response = await fetch(`${this.config.baseUrl}/models`, {
                signal: AbortSignal.timeout(5000)
            });

            if (!response.ok) {
                return DEFAULT_MODELS;
            }

            const data = await response.json();

            if (!data.data || data.data.length === 0) {
                return [{
                    id: 'no-model-loaded',
                    name: 'No model loaded',
                    provider: 'lmstudio',
                    contextLength: 8192,
                    description: 'Load a model in LM Studio to use it here'
                }];
            }

            return data.data.map((m: any) => ({
                id: m.id,
                name: m.id,
                provider: 'lmstudio' as const,
                contextLength: 8192, // LM Studio doesn't report this
                description: 'Local model'
            }));
        } catch {
            return DEFAULT_MODELS;
        }
    }

    async chat(
        messages: ChatMessage[],
        options: ChatOptions,
        _apiKey?: string
    ): Promise<ChatResponse> {
        const body: any = {
            model: options.model,
            messages,
            stream: false
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
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error?.message || `LM Studio error: ${response.status}`);
        }

        const data = await response.json();

        return {
            content: data.choices[0]?.message?.content || '',
            model: data.model || options.model,
            usage: data.usage ? {
                promptTokens: data.usage.prompt_tokens,
                completionTokens: data.usage.completion_tokens,
                totalTokens: data.usage.total_tokens
            } : undefined
        };
    }

    async checkStatus(_apiKey?: string): Promise<ProviderStatus> {
        try {
            const isRunning = await this.isServerRunning();
            if (!isRunning) {
                return {
                    available: false,
                    error: 'LM Studio is not running. Start the server in LM Studio.',
                    modelsLoaded: false
                };
            }

            const models = await this.getModels();
            const hasModels = models.length > 0 && models[0].id !== 'no-model-loaded';

            return {
                available: true,
                error: hasModels ? undefined : 'No model loaded in LM Studio',
                modelsLoaded: hasModels
            };
        } catch (e) {
            return {
                available: false,
                error: 'Cannot connect to LM Studio. Make sure it is running.'
            };
        }
    }
}

export const lmstudioProvider = new LMStudioProvider();
