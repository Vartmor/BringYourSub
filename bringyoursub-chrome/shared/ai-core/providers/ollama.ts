/**
 * BringYourSub - Ollama Provider
 * 
 * Provider implementation for Ollama local server.
 * Runs local models on user's machine via Ollama API.
 * 
 * @module providers/ollama
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
        id: 'llama3.2',
        name: 'Llama 3.2',
        provider: 'ollama',
        contextLength: 128000,
        description: 'Latest Llama model from Meta'
    },
    {
        id: 'mistral',
        name: 'Mistral 7B',
        provider: 'ollama',
        contextLength: 32000,
        description: 'Fast and efficient model'
    },
    {
        id: 'qwen2.5',
        name: 'Qwen 2.5',
        provider: 'ollama',
        contextLength: 128000,
        description: 'Alibaba Qwen model'
    }
];

const PROVIDER_CONFIG: ProviderConfig = {
    id: 'ollama',
    name: 'Ollama',
    description: 'Run local AI models with Ollama',
    website: 'https://ollama.ai',
    apiKeyPlaceholder: 'Not required',
    apiKeyPrefix: '',
    baseUrl: 'http://localhost:11434',
    requiresApiKey: false,
    isLocal: true,
    defaultModels: DEFAULT_MODELS
};

export class OllamaProvider implements AIProvider {
    readonly config = PROVIDER_CONFIG;

    async validateApiKey(_apiKey: string): Promise<boolean> {
        // Ollama doesn't require an API key
        return this.isServerRunning();
    }

    private async isServerRunning(): Promise<boolean> {
        try {
            const response = await fetch(`${this.config.baseUrl}/api/tags`, {
                signal: AbortSignal.timeout(3000)
            });
            return response.ok;
        } catch {
            return false;
        }
    }

    async getModels(_apiKey?: string): Promise<Model[]> {
        try {
            const response = await fetch(`${this.config.baseUrl}/api/tags`, {
                signal: AbortSignal.timeout(5000)
            });

            if (!response.ok) {
                return DEFAULT_MODELS;
            }

            const data = await response.json();

            if (!data.models || data.models.length === 0) {
                return [{
                    id: 'no-models',
                    name: 'No models installed',
                    provider: 'ollama',
                    contextLength: 8192,
                    description: 'Run "ollama pull llama3.2" to download a model'
                }];
            }

            return data.models.map((m: any) => ({
                id: m.name,
                name: m.name,
                provider: 'ollama' as const,
                contextLength: 8192, // Ollama doesn't report this consistently
                description: `Size: ${formatBytes(m.size)}`
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
        // Ollama uses slightly different message format for chat
        const body: any = {
            model: options.model,
            messages,
            stream: false,
            options: {}
        };

        if (options.temperature !== undefined) {
            body.options.temperature = options.temperature;
        }

        if (options.maxTokens) {
            body.options.num_predict = options.maxTokens;
        }

        const response = await fetch(`${this.config.baseUrl}/api/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || `Ollama error: ${response.status}`);
        }

        const data = await response.json();

        return {
            content: data.message?.content || '',
            model: data.model || options.model,
            usage: data.eval_count ? {
                promptTokens: data.prompt_eval_count || 0,
                completionTokens: data.eval_count,
                totalTokens: (data.prompt_eval_count || 0) + data.eval_count
            } : undefined
        };
    }

    async checkStatus(_apiKey?: string): Promise<ProviderStatus> {
        try {
            const isRunning = await this.isServerRunning();
            if (!isRunning) {
                return {
                    available: false,
                    error: 'Ollama is not running. Start Ollama to use local models.',
                    modelsLoaded: false
                };
            }

            const models = await this.getModels();
            const hasModels = models.length > 0 && models[0].id !== 'no-models';

            return {
                available: true,
                error: hasModels ? undefined : 'No models installed. Run "ollama pull llama3.2" to get started.',
                modelsLoaded: hasModels
            };
        } catch {
            return {
                available: false,
                error: 'Cannot connect to Ollama. Make sure it is running.'
            };
        }
    }
}

// Helper function
function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export const ollamaProvider = new OllamaProvider();
