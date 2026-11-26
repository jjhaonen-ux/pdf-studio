import type {
  ExportProgressEvent,
  PageAnnotation,
  ProjectPage,
  SourcePdfFile,
  TextExportMode,
} from '@/types/pdf';
import { exportMergedPdf } from './engine';
import { renderTextAnnotationToPng } from './textRenderer';
import type { ExportWorkerRequest, ExportWorkerResponse } from './pdfExport.worker';

let sharedWorker: Worker | null = null;
let activeAbortReject: ((reason?: unknown) => void) | null = null;

export function isWebWorkerSupported(): boolean {
  return typeof window !== 'undefined' && typeof Worker !== 'undefined';
}

function getOrCreateExportWorker(): Worker {
  if (!sharedWorker) {
    sharedWorker = new Worker(new URL('./pdfExport.worker.ts', import.meta.url), {
      type: 'module',
    });
  }
  return sharedWorker;
}

/**
 * إلغاء عملية التصدير الجارية فوراً وتنظيف الـ Worker
 */
export function cancelActiveExport(): void {
  if (sharedWorker) {
    sharedWorker.terminate();
    sharedWorker = null;
  }
  if (activeAbortReject) {
    activeAbortReject(new Error('EXPORT_CANCELLED'));
    activeAbortReject = null;
  }
}

/**
 * إرسال مهمة التصدير إلى Web Worker لمنع تجمد الواجهة، مع تقليل حجم البيانات المرسلة
 * عبر إرسال الملفات المستخدمة في الصفحات النشطة فقط.
 */
export async function exportPdfInWorker(
  sourceFiles: Record<string, SourcePdfFile>,
  pages: ProjectPage[],
  annotations: PageAnnotation[],
  options: {
    textExportMode: TextExportMode;
    onProgress?: (progress: ExportProgressEvent) => void;
  }
): Promise<Uint8Array> {
  const activePages = pages.filter((p) => !p.deleted);
  const usedFileIds = new Set(activePages.map((p) => p.sourceFileId));
  const usedPageIds = new Set(activePages.map((p) => p.id));

  // إرسال الملفات والعناصر المستخدمة فعلياً فقط لتقليل استهلاك الذاكرة
  const minimalSources: Record<string, SourcePdfFile> = {};
  for (const fid of Array.from(usedFileIds)) {
    const src = sourceFiles[fid];
    if (src) minimalSources[fid] = src;
  }
  const activeAnnotations = annotations.filter((a) => usedPageIds.has(a.pageId));

  // تجهيز النصوص مسبقاً في الخيط الرئيسي فقط إذا اختار المستخدم وضع التصدير كصورة (raster)
  let preRenderedTextPngs: Record<string, Uint8Array> | undefined;
  if (options.textExportMode === 'raster') {
    preRenderedTextPngs = {};
    for (const ann of activeAnnotations) {
      if (ann.type === 'text' && (ann.content.trim() || ann.backgroundColor !== 'transparent')) {
        // نستخدم أبعاد A4 قياسية متناسبة مع النسب المئوية للمربع
        const estWidthPt = Math.max(40, ann.widthRatio * 595);
        const estHeightPt = Math.max(24, ann.heightRatio * 842);
        const png = renderTextAnnotationToPng(ann, estWidthPt, estHeightPt);
        if (png) {
          preRenderedTextPngs[ann.id] = png;
        }
      }
    }
  }

  if (!isWebWorkerSupported()) {
    return exportMergedPdf(minimalSources, activePages, activeAnnotations, {
      textExportMode: options.textExportMode,
      preRenderedTextPngs,
      onProgress: options.onProgress,
    });
  }

  const worker = getOrCreateExportWorker();
  const requestId = crypto.randomUUID();

  return new Promise<Uint8Array>((resolve, reject) => {
    activeAbortReject = reject;

    const cleanup = () => {
      worker.removeEventListener('message', handleMessage);
      worker.removeEventListener('error', handleError);
      if (activeAbortReject === reject) {
        activeAbortReject = null;
      }
    };

    const handleMessage = (event: MessageEvent<ExportWorkerResponse>) => {
      const data = event.data;
      if (data.id !== requestId) return;

      if (data.type === 'progress') {
        options.onProgress?.(data.progress);
      } else if (data.type === 'result') {
        cleanup();
        resolve(data.bytes);
      } else if (data.type === 'error') {
        cleanup();
        reject(new Error(data.message));
      }
    };

    const handleError = (err: ErrorEvent) => {
      cleanup();
      if (sharedWorker) {
        sharedWorker.terminate();
        sharedWorker = null;
      }
      reject(new Error(err.message || 'تعذر تشغيل المعالجة في الخلفية.'));
    };

    worker.addEventListener('message', handleMessage);
    worker.addEventListener('error', handleError);

    const request: ExportWorkerRequest = {
      id: requestId,
      sourceFiles: minimalSources,
      pages: activePages,
      annotations: activeAnnotations,
      textExportMode: options.textExportMode,
      preRenderedTextPngs,
    };

    worker.postMessage(request);
  });
}
