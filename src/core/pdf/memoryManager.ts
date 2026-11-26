import type { PageAnnotation, SourcePdfFile } from '@/types/pdf';
import { PDF_LIMITS } from './limits';
import { getThumbnailCacheStats } from './thumbnails';

export type MemoryHealthLevel = 'normal' | 'warning' | 'high';

export interface MemoryUsageSnapshot {
  pdfBytes: number;
  annotationBytes: number;
  thumbnailBytes: number;
  totalBytes: number;
  limitBytes: number;
  usageRatio: number;
  level: MemoryHealthLevel;
  cachedThumbnails: number;
  maxCachedThumbnails: number;
}

export function estimateProjectMemory(
  sourceFiles: Record<string, SourcePdfFile>,
  annotations: PageAnnotation[]
): MemoryUsageSnapshot {
  let pdfBytes = 0;
  for (const src of Object.values(sourceFiles)) {
    pdfBytes += src.bytes.byteLength;
  }

  let annotationBytes = 0;
  for (const ann of annotations) {
    if (ann.type === 'text') {
      annotationBytes += ann.content.length * 2;
    } else {
      annotationBytes += ann.dataUrl.length;
    }
  }

  const thumbStats = getThumbnailCacheStats();
  const totalBytes = pdfBytes + annotationBytes + thumbStats.approxBytes;
  const limitBytes = PDF_LIMITS.MAX_TOTAL_MEMORY_BYTES;
  const usageRatio = Math.min(1, totalBytes / limitBytes);

  let level: MemoryHealthLevel = 'normal';
  if (usageRatio >= 0.85) {
    level = 'high';
  } else if (usageRatio >= PDF_LIMITS.MEMORY_WARNING_RATIO) {
    level = 'warning';
  }

  return {
    pdfBytes,
    annotationBytes,
    thumbnailBytes: thumbStats.approxBytes,
    totalBytes,
    limitBytes,
    usageRatio,
    level,
    cachedThumbnails: thumbStats.entries,
    maxCachedThumbnails: thumbStats.maxEntries,
  };
}
