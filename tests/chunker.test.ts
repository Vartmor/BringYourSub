/**
 * Unit Tests for Chunker Module
 * 
 * Tests the transcript chunking, SRT generation, and error recovery functions.
 */

import { describe, it, expect } from 'vitest';
import {
    chunkTranscript,
    estimateTranscript,
    rechunkOnError,
    generateSRT,
    splitIntoSRTSegments,
    TranscriptChunk
} from '../bringyoursub-chrome/shared/ai-core/chunker';

describe('estimateTranscript', () => {
    it('should classify short video correctly', () => {
        const shortText = 'A'.repeat(2000); // ~3.3 min
        const result = estimateTranscript(shortText);

        expect(result.isLongVideo).toBe(false);
        expect(result.estimatedDuration).toBeLessThan(10);
        expect(result.recommendedChunkSize).toBe(3000);
        expect(result.warningMessage).toBeUndefined();
    });

    it('should classify long video and show warning', () => {
        const longText = 'A'.repeat(30000); // ~50 min
        const result = estimateTranscript(longText);

        expect(result.isLongVideo).toBe(true);
        expect(result.estimatedDuration).toBeGreaterThan(30);
        expect(result.warningMessage).toBeDefined();
    });

    it('should recommend smaller chunks for very long videos', () => {
        const veryLongText = 'A'.repeat(60000); // ~100 min
        const result = estimateTranscript(veryLongText);

        expect(result.recommendedChunkSize).toBeLessThanOrEqual(1500);
    });
});

describe('chunkTranscript', () => {
    it('should return single chunk for short text', () => {
        const text = 'This is a short sentence. Another one here.';
        const chunks = chunkTranscript(text);

        expect(chunks).toHaveLength(1);
        expect(chunks[0].content).toBe(text);
        expect(chunks[0].index).toBe(1);
        expect(chunks[0].total).toBe(1);
    });

    it('should split at sentence boundaries', () => {
        // Create text that needs to be split
        const sentence = 'This is a sentence with some content. ';
        const longText = sentence.repeat(100);
        const chunks = chunkTranscript(longText, 500); // Small chunk size

        expect(chunks.length).toBeGreaterThan(1);

        // Each chunk should end with a complete sentence
        chunks.forEach(chunk => {
            expect(chunk.content.endsWith('.') || chunk.content.endsWith('?') || chunk.content.endsWith('!')).toBe(true);
        });
    });

    it('should have correct index and total values', () => {
        const text = 'First sentence. Second sentence. Third sentence. Fourth sentence.';
        const chunks = chunkTranscript(text, 100);

        chunks.forEach((chunk, i) => {
            expect(chunk.index).toBe(i + 1);
            expect(chunk.total).toBe(chunks.length);
        });
    });

    it('should estimate duration for each chunk', () => {
        const text = 'This is some text to translate.';
        const chunks = chunkTranscript(text);

        expect(chunks[0].estimatedDuration).toBeGreaterThan(0);
    });
});

describe('rechunkOnError', () => {
    it('should split a chunk into smaller pieces', () => {
        const chunk: TranscriptChunk = {
            index: 1,
            total: 1,
            content: 'First sentence. Second sentence. Third sentence. Fourth sentence.',
            estimatedDuration: 20
        };

        const smallerChunks = rechunkOnError(chunk, 2);

        expect(smallerChunks.length).toBeGreaterThan(1);
    });

    it('should preserve all content when rechunking', () => {
        const chunk: TranscriptChunk = {
            index: 1,
            total: 1,
            content: 'First. Second. Third. Fourth.',
            estimatedDuration: 10
        };

        const smallerChunks = rechunkOnError(chunk, 2);
        const recombined = smallerChunks.map(c => c.content).join(' ');

        // Content should be preserved (may have slight whitespace differences)
        expect(recombined.replace(/\s+/g, ' ')).toContain('First');
        expect(recombined.replace(/\s+/g, ' ')).toContain('Fourth');
    });
});

describe('generateSRT', () => {
    it('should generate valid SRT format', () => {
        const segments = [
            { content: 'First subtitle', startTime: 0, endTime: 5 },
            { content: 'Second subtitle', startTime: 5, endTime: 10 }
        ];

        const srt = generateSRT(segments);

        expect(srt).toContain('1\n');
        expect(srt).toContain('00:00:00,000 --> 00:00:05,000');
        expect(srt).toContain('First subtitle');
        expect(srt).toContain('2\n');
        expect(srt).toContain('00:00:05,000 --> 00:00:10,000');
    });

    it('should format timestamps with hours, minutes, seconds', () => {
        const segments = [
            { content: 'Test', startTime: 3661.5, endTime: 3665.75 } // 1:01:01.500
        ];

        const srt = generateSRT(segments);

        expect(srt).toContain('01:01:01,500');
        expect(srt).toContain('01:01:05,750');
    });

    it('should use comma for millisecond separator', () => {
        const segments = [
            { content: 'Test', startTime: 1.234, endTime: 2.567 }
        ];

        const srt = generateSRT(segments);

        expect(srt).toContain(',234');
        expect(srt).not.toContain('.234');
    });
});

describe('splitIntoSRTSegments', () => {
    it('should split text into ~5 second segments', () => {
        const text = 'This is sentence one. This is sentence two. This is sentence three. This is sentence four.';
        const totalDuration = 20;

        const segments = splitIntoSRTSegments(text, totalDuration);

        expect(segments.length).toBeGreaterThan(1);

        // Each segment should be roughly 5 seconds
        segments.forEach(segment => {
            const duration = segment.endTime - segment.startTime;
            expect(duration).toBeLessThanOrEqual(10); // Allow some flexibility
        });
    });

    it('should cover the full duration', () => {
        const text = 'Some text content here.';
        const totalDuration = 30;

        const segments = splitIntoSRTSegments(text, totalDuration);

        expect(segments[0].startTime).toBe(0);
        expect(segments[segments.length - 1].endTime).toBe(totalDuration);
    });

    it('should have non-overlapping timestamps', () => {
        const text = 'First part. Second part. Third part. Fourth part.';
        const totalDuration = 20;

        const segments = splitIntoSRTSegments(text, totalDuration);

        for (let i = 1; i < segments.length; i++) {
            expect(segments[i].startTime).toBeGreaterThanOrEqual(segments[i - 1].endTime - 0.01);
        }
    });
});
