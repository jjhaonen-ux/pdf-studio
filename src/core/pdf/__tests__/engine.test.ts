import { describe, expect, it } from 'vitest';
import { PDFDocument, degrees } from 'pdf-lib';
import { exportMergedPdf } from '../engine';
import type {
  ExportProgressEvent,
  PageAnnotation,
  ProjectPage,
  SourcePdfFile,
} from '@/types/pdf';

const SAMPLE_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function createSamplePdf(pageCount: number, initialRotation = 0): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) {
    const page = doc.addPage([400, 600]);
    if (initialRotation !== 0) {
      page.setRotation(degrees(initialRotation));
    }
  }
  return doc.save();
}

describe('exportMergedPdf (Phase 4: Vector Arabic TTF + Progress)', () => {
  it('يدمج صفحات من ملفين مع تجاهل المحذوف وتطبيق التدوير التراكمي', async () => {
    const bytesA = await createSamplePdf(2, 90);
    const bytesB = await createSamplePdf(2, 0);

    const sourceFiles: Record<string, SourcePdfFile> = {
      a: {
        id: 'a',
        name: 'a.pdf',
        sizeBytes: bytesA.byteLength,
        pageCount: 2,
        bytes: bytesA,
        pageRangeInput: '',
        colorTag: '#2563eb',
      },
      b: {
        id: 'b',
        name: 'b.pdf',
        sizeBytes: bytesB.byteLength,
        pageCount: 2,
        bytes: bytesB,
        pageRangeInput: '',
        colorTag: '#059669',
      },
    };

    const pages: ProjectPage[] = [
      { id: '1', sourceFileId: 'b', sourcePageIndex: 1, rotation: 180, deleted: false },
      { id: '2', sourceFileId: 'a', sourcePageIndex: 0, rotation: 90, deleted: false },
      { id: '3', sourceFileId: 'a', sourcePageIndex: 1, rotation: 0, deleted: true },
    ];

    const mergedBytes = await exportMergedPdf(sourceFiles, pages);
    const mergedDoc = await PDFDocument.load(mergedBytes);

    expect(mergedDoc.getPageCount()).toBe(2);
    expect(mergedDoc.getPage(0).getRotation().angle).toBe(180);
    expect(mergedDoc.getPage(1).getRotation().angle).toBe(180);
  });

  it('يضمّن خطاً عربياً متجهاً (TTF) مع تشكيل وBiDi وتوقيع ويُبلغ عن التقدم حتى 100%', async () => {
    const bytes = await createSamplePdf(2, 0);
    const progressLog: ExportProgressEvent[] = [];

    const sourceFiles: Record<string, SourcePdfFile> = {
      doc1: {
        id: 'doc1',
        name: 'doc1.pdf',
        sizeBytes: bytes.byteLength,
        pageCount: 2,
        bytes,
        pageRangeInput: '',
        colorTag: '#2563eb',
      },
    };

    const pages: ProjectPage[] = [
      { id: 'p1', sourceFileId: 'doc1', sourcePageIndex: 0, rotation: 0, deleted: false },
      { id: 'p2', sourceFileId: 'doc1', sourcePageIndex: 1, rotation: 90, deleted: false },
    ];

    const annotations: PageAnnotation[] = [
      {
        id: 'ann-ar',
        pageId: 'p1',
        type: 'text',
        content: 'مُعتَمَد — فاتورة رقم INV-2026 (نسخة أصلية)',
        xRatio: 0.15,
        yRatio: 0.2,
        widthRatio: 0.65,
        heightRatio: 0.15,
        fontSize: 16,
        colorHex: '#1d4ed8',
        bold: true,
        align: 'right',
        backgroundColor: '#ffffff',
        opacity: 1,
      },
      {
        id: 'ann-sig',
        pageId: 'p2',
        type: 'signature',
        mimeType: 'image/png',
        dataUrl: SAMPLE_PNG_DATA_URL,
        aspectRatio: 1,
        xRatio: 0.5,
        yRatio: 0.7,
        widthRatio: 0.25,
        heightRatio: 0.1,
        opacity: 0.9,
      },
    ];

    const exportedBytes = await exportMergedPdf(sourceFiles, pages, annotations, {
      textExportMode: 'vector',
      onProgress: (ev) => progressLog.push(ev),
    });

    const exportedDoc = await PDFDocument.load(exportedBytes);
    expect(exportedDoc.getPageCount()).toBe(2);
    expect(exportedBytes.byteLength).toBeGreaterThan(bytes.byteLength);
    expect(progressLog.length).toBeGreaterThan(0);
    expect(progressLog[progressLog.length - 1].percent).toBe(100);
  });
});
