/// <reference lib="webworker" />

import type {
  ExportProgressEvent,
  PageAnnotation,
  ProjectPage,
  SourcePdfFile,
  TextExportMode,
} from '@/types/pdf';
import { exportMergedPdf } from './engine';

export interface ExportWorkerRequest {
  id: string;
  sourceFiles: Record<string, SourcePdfFile>;
  pages: ProjectPage[];
  annotations: PageAnnotation[];
  textExportMode: TextExportMode;
  preRenderedTextPngs?: Record<string, Uint8Array>;
}

export type ExportWorkerResponse =
  | { type: 'progress'; id: string; progress: ExportProgressEvent }
  | { type: 'result'; id: string; bytes: Uint8Array }
  | { type: 'error'; id: string; message: string };

const ctx: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = async (event: MessageEvent<ExportWorkerRequest>) => {
  const { id, sourceFiles, pages, annotations, textExportMode, preRenderedTextPngs } =
    event.data;

  try {
    const outputBytes = await exportMergedPdf(sourceFiles, pages, annotations, {
      textExportMode,
      preRenderedTextPngs,
      onProgress: (progress) => {
        const msg: ExportWorkerResponse = { type: 'progress', id, progress };
        ctx.postMessage(msg);
      },
    });

    const msg: ExportWorkerResponse = { type: 'result', id, bytes: outputBytes };
    // نقل ملكية الذاكرة (Transferable) إلى الخيط الرئيسي دون نسخ مزدوج
    ctx.postMessage(msg, [outputBytes.buffer]);
  } catch (err) {
    const msg: ExportWorkerResponse = {
      type: 'error',
      id,
      message: err instanceof Error ? err.message : 'حدث خطأ أثناء المعالجة في الخلفية.',
    };
    ctx.postMessage(msg);
  }
};
