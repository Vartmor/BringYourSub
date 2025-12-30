/**
 * BringYourSub - Provider Registry
 * 
 * Central registry for all AI providers.
 * Provides unified access to all provider implementations.
 * 
 * @module providers/index
 */

import type { AIProvider, ProviderId, Model, ProviderSettings } from './types';
import { openaiProvider } from './openai';
import { anthropicProvider } from './anthropic';
import { googleProvider } from './google';
import { groqProvider } from './groq';
import { openrouterProvider } from './openrouter';
import { lmstudioProvider } from './lmstudio';
import { ollamaProvider } from './ollama';

// Re-export types
export * from './types';

/**
 * All available providers
 */
export const providers: Record<ProviderId, AIProvider> = {
    openai: openaiProvider,
    anthropic: anthropicProvider,
    google: googleProvider,
    groq: groqProvider,
    openrouter: openrouterProvider,
    lmstudio: lmstudioProvider,
    ollama: ollamaProvider
};

/**
 * Cloud providers (require API key)
 */
export const cloudProviders: ProviderId[] = ['openai', 'anthropic', 'google', 'groq', 'openrouter'];

/**
 * Local providers (no API key required)
 */
export const localProviders: ProviderId[] = ['lmstudio', 'ollama'];

/**
 * Get a provider by ID
 */
export function getProvider(id: ProviderId): AIProvider {
    const provider = providers[id];
    if (!provider) {
        throw new Error(`Unknown provider: ${id}`);
    }
    return provider;
}

/**
 * Get all provider configs for UI display
 */
export function getAllProviderConfigs() {
    return Object.values(providers).map(p => p.config);
}

/**
 * Default provider settings
 */
export const defaultProviderSettings: ProviderSettings = {
    selectedProvider: 'openai',
    apiKeys: {},
    selectedModels: {
        openai: 'gpt-4o-mini',
        anthropic: 'claude-3-5-sonnet-latest',
        google: 'gemini-1.5-flash',
        groq: 'llama-3.3-70b-versatile',
        openrouter: 'openai/gpt-4o-mini'
    },
    modelCache: {}
};

/**
 * Provider Manager
 * 
 * Handles provider state, model caching, and settings persistence.
 */
export class ProviderManager {
    private settings: ProviderSettings = defaultProviderSettings;
    private static CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

    /**
     * Initialize from storage
     */
    async init(): Promise<void> {
        const data = await chrome.storage.local.get(['providerSettings']);
        if (data.providerSettings) {
            this.settings = { ...defaultProviderSettings, ...data.providerSettings };
        }
    }

    /**
     * Save settings to storage
     */
    async save(): Promise<void> {
        await chrome.storage.local.set({ providerSettings: this.settings });
    }

    /**
     * Get current provider
     */
    getCurrentProvider(): AIProvider {
        return getProvider(this.settings.selectedProvider);
    }

    /**
     * Get current provider ID
     */
    getCurrentProviderId(): ProviderId {
        return this.settings.selectedProvider;
    }

    /**
     * Set current provider
     */
    async setProvider(id: ProviderId): Promise<void> {
        this.settings.selectedProvider = id;
        await this.save();
    }

    /**
     * Get API key for a provider
     */
    getApiKey(providerId?: ProviderId): string | undefined {
        const id = providerId || this.settings.selectedProvider;
        return this.settings.apiKeys[id];
    }

    /**
     * Set API key for a provider
     */
    async setApiKey(providerId: ProviderId, apiKey: string): Promise<void> {
        this.settings.apiKeys[providerId] = apiKey;
        await this.save();
    }

    /**
     * Get selected model for a provider
     */
    getSelectedModel(providerId?: ProviderId): string {
        const id = providerId || this.settings.selectedProvider;
        return this.settings.selectedModels[id] ||
            providers[id].config.defaultModels[0]?.id || '';
    }

    /**
     * Set selected model for a provider
     */
    async setSelectedModel(providerId: ProviderId, modelId: string): Promise<void> {
        this.settings.selectedModels[providerId] = modelId;
        await this.save();
    }

    /**
     * Get models for a provider (with caching)
     */
    async getModels(providerId?: ProviderId, forceRefresh = false): Promise<Model[]> {
        const id = providerId || this.settings.selectedProvider;
        const provider = providers[id];
        const apiKey = this.settings.apiKeys[id];

        // Check cache
        const cached = this.settings.modelCache[id];
        const now = Date.now();

        if (!forceRefresh && cached && (now - cached.lastUpdated) < ProviderManager.CACHE_DURATION) {
            return cached.models;
        }

        // Fetch fresh models
        try {
            const models = await provider.getModels(apiKey);

            // Update cache
            this.settings.modelCache[id] = {
                models,
                lastUpdated: now
            };
            await this.save();

            return models;
        } catch {
            // Return cached models or defaults on error
            return cached?.models || provider.config.defaultModels;
        }
    }

    /**
     * Validate current provider's API key
     */
    async validateCurrentApiKey(): Promise<boolean> {
        const provider = this.getCurrentProvider();
        const apiKey = this.getApiKey();

        if (provider.config.requiresApiKey && !apiKey) {
            return false;
        }

        return provider.validateApiKey(apiKey || '');
    }

    /**
     * Get all settings
     */
    getSettings(): ProviderSettings {
        return { ...this.settings };
    }
}

// Export singleton instance
export const providerManager = new ProviderManager();
