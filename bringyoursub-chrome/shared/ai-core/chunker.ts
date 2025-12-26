/**
 * Smart Transcript Chunker
 * 
 * Intelligently splits transcripts into chunks optimized for:
 * - Token limits of LLM models
 * - Sentence boundaries (no mid-sentence breaks)
 * - SRT segment timing (~5 seconds per segment)
 * 
 * @module ai-core/chunker
 */

/** Chunked transcript with metadata */
export interface TranscriptChunk {
  index: number;
  total: number;
  content: string;
  estimatedDuration: number; // seconds
}

/** Configuration for chunking */
export interface ChunkConfig {
  maxTokens: number;
  targetSegmentDuration: number; // seconds
}

/** Estimates for different transcript types */
interface TranscriptEstimates {
  isLongVideo: boolean;
  estimatedDuration: number; // minutes
  recommendedChunkSize: number;
  warningMessage?: string;
}

/**
 * Estimates video characteristics from transcript length
 * Average speaking rate: ~150 words/minute = ~600 chars/minute
 */
export function estimateTranscript(text: string): TranscriptEstimates {
  const charCount = text.length;
  const charsPerMinute = 600;
  const estimatedMinutes = charCount / charsPerMinute;

  let recommendedChunkSize: number;
  let warningMessage: string | undefined;

  if (estimatedMinutes <= 5) {
    // Short video: use larger chunks
    recommendedChunkSize = 3000;
  } else if (estimatedMinutes <= 15) {
    // Medium video
    recommendedChunkSize = 2500;
  } else if (estimatedMinutes <= 30) {
    // Long video
    recommendedChunkSize = 2000;
    warningMessage = "Long video detected. Processing may take a few minutes.";
  } else if (estimatedMinutes <= 60) {
    // Very long video
    recommendedChunkSize = 1500;
    warningMessage = "Very long video detected. Processing will take several minutes.";
  } else {
    // Extremely long video
    recommendedChunkSize = 1000;
    warningMessage = "⚠️ Extremely long video. Processing may take a while and use significant API credits.";
  }

  return {
    isLongVideo: estimatedMinutes > 15,
    estimatedDuration: Math.round(estimatedMinutes),
    recommendedChunkSize,
    warningMessage
  };
}

/**
 * Chunks a transcript into segments for translation
 * 
 * @param text - The full transcript text
 * @param maxTokens - Maximum tokens per chunk (default: auto-calculated)
 * @returns Array of chunks with metadata
 */
export function chunkTranscript(text: string, maxTokens?: number): TranscriptChunk[] {
  const estimates = estimateTranscript(text);
  const effectiveMaxTokens = maxTokens || estimates.recommendedChunkSize;

  const charactersPerToken = 4;
  const maxChars = effectiveMaxTokens * charactersPerToken;

  // Split by sentences (handles multiple punctuation types)
  const sentences = text.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) || [text];

  const chunks: string[] = [];
  let currentChunk = "";

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    if (!trimmedSentence) continue;

    // If adding this sentence exceeds limit, start new chunk
    if (currentChunk.length + trimmedSentence.length > maxChars && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = "";
    }

    currentChunk += (currentChunk ? " " : "") + trimmedSentence;
  }

  // Add remaining content
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  // Calculate estimated duration per chunk
  const charsPerSecond = 10; // ~150 words/min = 10 chars/sec

  return chunks.map((content, index) => ({
    index: index + 1,
    total: chunks.length,
    content,
    estimatedDuration: Math.ceil(content.length / charsPerSecond)
  }));
}

/**
 * Creates smaller chunks from a failed chunk
 * Used when token limit is exceeded
 */
export function rechunkOnError(chunk: TranscriptChunk, factor: number = 2): TranscriptChunk[] {
  const sentences = chunk.content.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) || [chunk.content];
  const targetSize = Math.ceil(sentences.length / factor);

  const smallerChunks: string[] = [];
  let currentChunk: string[] = [];

  for (const sentence of sentences) {
    currentChunk.push(sentence.trim());
    if (currentChunk.length >= targetSize) {
      smallerChunks.push(currentChunk.join(" "));
      currentChunk = [];
    }
  }

  if (currentChunk.length > 0) {
    smallerChunks.push(currentChunk.join(" "));
  }

  const charsPerSecond = 10;

  return smallerChunks.map((content, index) => ({
    index: index + 1,
    total: smallerChunks.length,
    content,
    estimatedDuration: Math.ceil(content.length / charsPerSecond)
  }));
}

/**
 * Generates SRT formatted output from translated chunks
 */
export function generateSRT(
  chunks: Array<{ content: string; startTime: number; endTime: number }>
): string {
  return chunks.map((chunk, index) => {
    const formatTime = (seconds: number): string => {
      const hrs = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      const secs = Math.floor(seconds % 60);
      const ms = Math.floor((seconds % 1) * 1000);
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
    };

    return `${index + 1}\n${formatTime(chunk.startTime)} --> ${formatTime(chunk.endTime)}\n${chunk.content}\n`;
  }).join('\n');
}

/**
 * Splits text into SRT-style segments (~5 seconds each)
 */
export function splitIntoSRTSegments(
  text: string,
  totalDuration: number
): Array<{ content: string; startTime: number; endTime: number }> {
  const sentences = text.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) || [text];
  const segments: Array<{ content: string; startTime: number; endTime: number }> = [];

  const targetSegmentDuration = 5; // seconds
  const charsPerSecond = text.length / totalDuration;

  let currentSegment = "";
  let currentStartTime = 0;

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;

    const sentenceDuration = trimmed.length / charsPerSecond;

    if (currentSegment && (currentSegment.length / charsPerSecond) + sentenceDuration > targetSegmentDuration) {
      // Finalize current segment
      const endTime = currentStartTime + (currentSegment.length / charsPerSecond);
      segments.push({
        content: currentSegment,
        startTime: currentStartTime,
        endTime
      });
      currentStartTime = endTime;
      currentSegment = trimmed;
    } else {
      currentSegment += (currentSegment ? " " : "") + trimmed;
    }
  }

  // Add final segment
  if (currentSegment) {
    segments.push({
      content: currentSegment,
      startTime: currentStartTime,
      endTime: totalDuration
    });
  }

  return segments;
}
