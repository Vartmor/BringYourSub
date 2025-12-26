/**
 * AI Pipeline for Robust Per-Chunk Translation
 * 
 * This module implements a robust translation pipeline that:
 * 1. Translates each chunk independently (more fault-tolerant)
 * 2. Retries on failure with exponential backoff
 * 3. Reduces chunk size if token limit exceeded
 * 4. Generates proper SRT format with timestamps
 * 5. Reports progress for UI updates
 * 
 * @module ai-core/pipeline
 */

import { rechunkOnError, splitIntoSRTSegments, generateSRT } from './chunker.js';

/** Configuration options for the AI pipeline */
export interface PipelineOptions {
    apiKey: string;
    targetLanguage: string;
    model?: string;
    videoMetadata: {
        title: string;
        channel: string;
    };
    onProgress?: (message: string, chunkIndex: number, totalChunks: number) => void;
}

/** OpenAI chat message format */
interface ChatMessage {
    role: "system" | "user" | "assistant";
    content: string;
}

/** OpenAI API response structure */
interface OpenAIResponse {
    choices: Array<{
        message: {
            content: string;
        };
    }>;
    error?: {
        message: string;
        type?: string;
        code?: string;
    };
}

/** Result of chunk translation */
interface ChunkResult {
    index: number;
    success: boolean;
    translation?: string;
    error?: string;
}

/** Pipeline statistics */
export interface PipelineStats {
    totalChunks: number;
    successfulChunks: number;
    failedChunks: number;
    retriedChunks: number;
    usedWhisper: boolean;
}

/**
 * AI Pipeline class with robust error handling and retry logic
 */
export class AIPipeline {
    private readonly apiKey: string;
    private readonly targetLanguage: string;
    private readonly videoMetadata: { title: string; channel: string };
    private readonly model: string;
    private readonly onProgress?: (message: string, chunkIndex: number, totalChunks: number) => void;

    private stats: PipelineStats = {
        totalChunks: 0,
        successfulChunks: 0,
        failedChunks: 0,
        retriedChunks: 0,
        usedWhisper: false
    };

    constructor(options: PipelineOptions) {
        this.apiKey = options.apiKey;
        this.targetLanguage = options.targetLanguage;
        this.model = options.model || "gpt-4o-mini";
        this.videoMetadata = options.videoMetadata;
        this.onProgress = options.onProgress;
    }

    /**
     * Makes a request to OpenAI with retry logic
     */
    private async callOpenAI(messages: ChatMessage[], retryCount = 0): Promise<string> {
        const maxRetries = 3;
        const baseDelay = 1000;

        try {
            const response = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: messages,
                    temperature: 0.3,
                    max_tokens: 4000
                })
            });

            if (!response.ok) {
                const error: OpenAIResponse = await response.json();
                const errorMessage = error.error?.message || "OpenAI API request failed";
                const errorCode = error.error?.code;

                // Handle rate limits with retry
                if (response.status === 429 && retryCount < maxRetries) {
                    const delay = baseDelay * Math.pow(2, retryCount);
                    console.log(`[BringYourSub] Rate limited, retrying in ${delay}ms...`);
                    await this.sleep(delay);
                    this.stats.retriedChunks++;
                    return this.callOpenAI(messages, retryCount + 1);
                }

                // Handle token limit errors
                if (errorCode === "context_length_exceeded") {
                    throw new Error("TOKEN_LIMIT_EXCEEDED");
                }

                throw new Error(errorMessage);
            }

            const data: OpenAIResponse = await response.json();
            return data.choices[0].message.content;
        } catch (error) {
            if (retryCount < maxRetries && error instanceof Error &&
                !error.message.includes("TOKEN_LIMIT") &&
                !error.message.includes("Invalid API")) {
                const delay = baseDelay * Math.pow(2, retryCount);
                await this.sleep(delay);
                this.stats.retriedChunks++;
                return this.callOpenAI(messages, retryCount + 1);
            }
            throw error;
        }
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Translates a single chunk with error handling
     */
    private async translateChunk(
        chunk: { content: string; index: number; total: number },
        context: string
    ): Promise<ChunkResult> {
        const systemPrompt = `You are a professional subtitle translator. Translate the following transcript segment to ${this.targetLanguage}.

Context: Video "${this.videoMetadata.title}" by ${this.videoMetadata.channel}
${context}

Rules:
- Translate naturally, as spoken language
- Keep technical terms consistent
- Do NOT summarize - translate everything
- Keep the same meaning and tone
- Output ONLY the translation, nothing else`;

        const messages: ChatMessage[] = [
            { role: "system", content: systemPrompt },
            { role: "user", content: chunk.content }
        ];

        try {
            const translation = await this.callOpenAI(messages);
            return {
                index: chunk.index,
                success: true,
                translation: translation.trim()
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error";

            // If token limit exceeded, try with smaller chunks
            if (errorMessage === "TOKEN_LIMIT_EXCEEDED") {
                console.log(`[BringYourSub] Token limit on chunk ${chunk.index}, splitting...`);
                const smallerChunks = rechunkOnError({ ...chunk, estimatedDuration: 0 });

                const results: string[] = [];
                for (const smallChunk of smallerChunks) {
                    const result = await this.translateChunk(
                        { content: smallChunk.content, index: smallChunk.index, total: smallChunk.total },
                        context
                    );
                    if (result.success && result.translation) {
                        results.push(result.translation);
                    }
                }

                if (results.length > 0) {
                    return {
                        index: chunk.index,
                        success: true,
                        translation: results.join(" ")
                    };
                }
            }

            return {
                index: chunk.index,
                success: false,
                error: errorMessage
            };
        }
    }

    /**
     * Runs the translation pipeline on all chunks
     * Returns SRT formatted subtitles
     */
    async translateChunks(
        chunks: Array<{ content: string; index: number; total: number; estimatedDuration: number }>
    ): Promise<{ srt: string; stats: PipelineStats }> {
        this.stats.totalChunks = chunks.length;
        const translations: Array<{ content: string; index: number; duration: number }> = [];

        // Build context from first chunk
        const contextSnippet = chunks[0]?.content.substring(0, 500) || "";
        const context = `This is part of a larger transcript. First few sentences for context: "${contextSnippet}..."`;

        for (const chunk of chunks) {
            this.onProgress?.(
                `Translating part ${chunk.index}/${chunk.total}...`,
                chunk.index,
                chunk.total
            );

            const result = await this.translateChunk(chunk, context);

            if (result.success && result.translation) {
                translations.push({
                    content: result.translation,
                    index: result.index,
                    duration: chunk.estimatedDuration
                });
                this.stats.successfulChunks++;
            } else {
                console.error(`[BringYourSub] Failed chunk ${chunk.index}: ${result.error}`);
                this.stats.failedChunks++;

                // Include original text as fallback
                translations.push({
                    content: `[Translation failed: ${chunk.content.substring(0, 100)}...]`,
                    index: chunk.index,
                    duration: chunk.estimatedDuration
                });
            }
        }

        // Calculate timestamps
        let currentTime = 0;
        const timedSegments: Array<{ content: string; startTime: number; endTime: number }> = [];

        for (const trans of translations.sort((a, b) => a.index - b.index)) {
            // Split translation into smaller SRT segments
            const segments = splitIntoSRTSegments(trans.content, trans.duration);

            for (const segment of segments) {
                timedSegments.push({
                    content: segment.content,
                    startTime: currentTime + segment.startTime,
                    endTime: currentTime + segment.endTime
                });
            }
            currentTime += trans.duration;
        }

        const srt = generateSRT(timedSegments);

        return { srt, stats: this.stats };
    }

    /**
     * Legacy method for backward compatibility
     */
    async runContextLockPipeline(
        chunks: Array<{ content: string; index: number; total: number }>
    ): Promise<string> {
        // Convert to new format
        const chunksWithDuration = chunks.map(c => ({
            ...c,
            estimatedDuration: Math.ceil(c.content.length / 10)
        }));

        const result = await this.translateChunks(chunksWithDuration);
        return result.srt;
    }

    getStats(): PipelineStats {
        return { ...this.stats };
    }

    setUsedWhisper(used: boolean): void {
        this.stats.usedWhisper = used;
    }
}
