/**
 * BringYourSub - Provider Base Types
 * 
 * Defines the base interfaces for AI providers.
 * All providers must implement the AIProvider interface.
 * 
 * @module providers/types
 */

/**
 * Available AI provider identifiers
 */
export type ProviderId =
    | 'openai'
    | 'anthropic'
    | 'google'
    | 'groq'
    | 'openrouter'
    | 'lmstudio'
    | 'ollama';

/**
 * Chat message format (OpenAI-compatible)
 */
export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

/**
 * Model information
 */
export interface Model {
    id: string;
    name: string;
    provider: ProviderId;
    contextLength?: number;
    supportsVision?: boolean;
    pricing?: {
        input: number;  // $ per 1M tokens
        output: number; // $ per 1M tokens
    };
    description?: string;
}

/**
 * Provider configuration
 */
export interface ProviderConfig {
    id: ProviderId;
    name: string;
    description: string;
    website: string;
    apiKeyPlaceholder: string;
    apiKeyPrefix: string;
    baseUrl: string;
    requiresApiKey: boolean;
    isLocal: boolean;
    defaultModels: Model[];
}

/**
 * Chat completion options
 */
export interface ChatOptions {
    model: string;
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;
}

/**
 * Chat completion response
 */
export interface ChatResponse {
    content: string;
    model: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}

/**
 * Provider status
 */
export interface ProviderStatus {
    available: boolean;
    error?: string;
    modelsLoaded?: boolean;
}

/**
 * Base AI Provider interface
 * All providers must implement this interface
 */
export interface AIProvider {
    readonly config: ProviderConfig;

    /**
     * Validate an API key
     */
    validateApiKey(apiKey: string): Promise<boolean>;

    /**
     * Get available models from the provider
     */
    getModels(apiKey?: string): Promise<Model[]>;

    /**
     * Send a chat completion request
     */
    chat(
        messages: ChatMessage[],
        options: ChatOptions,
        apiKey?: string
    ): Promise<ChatResponse>;

    /**
     * Check if the provider is available/reachable
     */
    checkStatus(apiKey?: string): Promise<ProviderStatus>;
}

/**
 * Stored provider settings
 */
export interface ProviderSettings {
    selectedProvider: ProviderId;
    apiKeys: Partial<Record<ProviderId, string>>;
    selectedModels: Partial<Record<ProviderId, string>>;
    modelCache: {
        [providerId: string]: {
            models: Model[];
            lastUpdated: number;
        };
    };
}
