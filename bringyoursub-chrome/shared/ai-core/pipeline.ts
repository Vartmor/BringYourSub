/**
 * AI Pipeline for Context-Lock Translation Strategy
 * 
 * This module implements a sophisticated translation pipeline that:
 * 1. Ingests video context and metadata first
 * 2. Processes transcript chunks while building context
 * 3. Generates final translation with full video understanding
 * 
 * @module ai-core/pipeline
 */

/** Configuration options for the AI pipeline */
export interface PipelineOptions {
    /** OpenAI API key for authentication */
    apiKey: string;
    /** Target language for translation (e.g., "Turkish", "Spanish") */
    targetLanguage: string;
    /** Video metadata for context understanding */
    videoMetadata: {
        /** Video title */
        title: string;
        /** Channel name */
        channel: string;
    };
}

/** OpenAI chat message format */
interface ChatMessage {
    /** Message role: 'system', 'user', or 'assistant' */
    role: "system" | "user" | "assistant";
    /** Message content */
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
    };
}

/**
 * AI Pipeline class that manages the context-lock translation strategy.
 * 
 * The context-lock strategy ensures consistent terminology and tone by:
 * - First feeding all transcript chunks to build context
 * - Only then requesting the final translation
 * 
 * @example
 * ```typescript
 * const pipeline = new AIPipeline({
 *     apiKey: "sk-...",
 *     targetLanguage: "Turkish",
 *     videoMetadata: { title: "Tech Review", channel: "TechChannel" }
 * });
 * const translated = await pipeline.runContextLockPipeline(chunks);
 * ```
 */
export class AIPipeline {
    private readonly apiKey: string;
    private readonly targetLanguage: string;
    private readonly videoMetadata: { title: string; channel: string };
    private readonly model: string = "gpt-4o-mini";

    constructor(options: PipelineOptions) {
        this.apiKey = options.apiKey;
        this.targetLanguage = options.targetLanguage;
        this.videoMetadata = options.videoMetadata;
    }

    /**
     * Makes a request to the OpenAI Chat Completions API.
     * 
     * @param messages - Array of chat messages to send
     * @returns The assistant's response content
     * @throws Error if the API request fails
     */
    private async callOpenAI(messages: ChatMessage[]): Promise<string> {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${this.apiKey}`
            },
            body: JSON.stringify({
                model: this.model,
                messages: messages,
                temperature: 0.2
            })
        });

        if (!response.ok) {
            const error: OpenAIResponse = await response.json();
            throw new Error(error.error?.message || "OpenAI API request failed");
        }

        const data: OpenAIResponse = await response.json();
        return data.choices[0].message.content;
    }

    /**
     * Runs the complete context-lock translation pipeline.
     * 
     * Pipeline phases:
     * 1. **Context Ingestion**: Initialize with video metadata
     * 2. **Chunk Feeding**: Send all transcript parts to build understanding
     * 3. **Final Translation**: Generate the complete translated subtitles
     * 
     * @param chunks - Array of transcript chunks with content and positioning info
     * @returns Translated subtitle text
     */
    async runContextLockPipeline(
        chunks: Array<{ content: string; index: number; total: number }>
    ): Promise<string> {
        const messages: ChatMessage[] = [
            {
                role: "system",
                content: "You are a professional subtitle translator. You will receive a YouTube video transcript in parts. Do NOT translate yet. Just understand context, terminology, tone. Reply only with: 'Context received'."
            },
            {
                role: "user",
                content: `Video Title: ${this.videoMetadata.title}\nChannel: ${this.videoMetadata.channel}\nUnderstand this context.`
            }
        ];

        // Phase 1: Context Ingestion
        await this.callOpenAI(messages);

        // Phase 2: Chunk Feeding - Build full context understanding
        for (const chunk of chunks) {
            messages.push({
                role: "user",
                content: `Part ${chunk.index}/${chunk.total}:\n${chunk.content}`
            });
            messages.push({
                role: "assistant",
                content: "Context received"
            });
        }

        // Phase 3: Final Translation Request
        messages.push({
            role: "user",
            content: `Now generate the full translated subtitles in ${this.targetLanguage}.

Rules:
- Natural spoken language
- No summarization
- Keep technical terms consistent
- Output plain subtitle text
- Maintain the flow of the original transcript`
        });

        return await this.callOpenAI(messages);
    }
}

