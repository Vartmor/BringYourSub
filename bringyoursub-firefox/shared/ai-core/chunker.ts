/**
 * Simple transcript chunker that splits text into chunks of approximately maxTokens.
 * We use a rough estimate of 4 characters per token if a tokenizer is not available.
 * It ensures that chunks do not split in the middle of a sentence.
 */

export interface TranscriptChunk {
  index: number;
  total: number;
  content: string;
}

export function chunkTranscript(text: string, maxTokens: number = 2500): TranscriptChunk[] {
  const charactersPerToken = 4;
  const maxChars = maxTokens * charactersPerToken;
  
  // Split by sentences (simple regex)
  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];
  
  const chunks: string[] = [];
  let currentChunk = "";

  for (const sentence of sentences) {
    if ((currentChunk.length + sentence.length) > maxChars && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = "";
    }
    currentChunk += sentence;
  }
  
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks.map((content, index) => ({
    index: index + 1,
    total: chunks.length,
    content
  }));
}
