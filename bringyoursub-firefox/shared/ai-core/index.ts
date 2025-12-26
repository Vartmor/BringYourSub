/**
 * BringYourSub AI Core Module Exports
 *
 * This barrel file provides clean imports for all AI pipeline components.
 *
 * @module ai-core
 *
 * @example
 * ```typescript
 * import {
 *     AIPipeline,
 *     getNativeYouTubeTranscript,
 *     getWhisperTranscript,
 *     chunkTranscript
 * } from "./shared/ai-core";
 * ```
 */

// Pipeline
export { AIPipeline, type PipelineOptions } from "./pipeline.js";

// Transcript extraction
export {
    getNativeYouTubeTranscript,
    getYouTubeVideoId,
    type TranscriptLine
} from "./transcript.js";

// Whisper fallback
export { getWhisperTranscript } from "./whisper.js";

// Chunking utilities
export { chunkTranscript, type TranscriptChunk } from "./chunker.js";
