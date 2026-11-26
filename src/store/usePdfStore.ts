'use client';

import { create } from 'zustand';
import type {
  ExportProgressEvent,
  ImageAnnotation,
  PageAnnotation,
  ProjectPage,
  RotationAngle,
  SavedSignature,
  SourcePdfFile,
  TextAnnotation,
  TextExportMode,
  WorkspaceMode,
} from '@/types/pdf';
import { FILE_COLOR_TAGS, PDF_LIMITS } from '@/core/pdf/limits';
import { loadSourcePdf, triggerPdfDownload } from '@/core/pdf/engine';
import { parsePageRange } from '@/core/pdf/rangeParser';
import {
  clearAllThumbnailCaches,
  clearFileThumbnailCache,
  purgeThumbnailCache,
} from '@/core/pdf/thumbnails';
import { clampNormalizedBox } from '@/core/pdf/coordinates';
import { cancelActiveExport, exportPdfInWorker } from '@/core/pdf/workerClient';
import { PdfProcessingError } from '@/core/pdf/errors';

interface HistorySnapshot {
  pages: ProjectPage[];
  annotations: PageAnnotation[];
}

interface PdfStoreState {
  sourceFiles: Record<string, SourcePdfFile>;
  fileOrder: string[];
  pages: ProjectPage[];
  annotations: PageAnnotation[];
  savedSignatures: SavedSignature[];

  mode: WorkspaceMode;
  activeEditorPageId: string | null;
  selectedAnnotationId: string | null;
  zoom: number;

  /** المرحلة 4: إعدادات التصدير والأداء */
  textExportMode: TextExportMode;
  exportProgress: ExportProgressEvent | null;
  cacheVersion: number;

  outputFilename: string;
  showDeleted: boolean;
  isLoading: boolean;
  isExporting: boolean;
  error: string | null;
  errorDetails: string[];
  statusMessage: string | null;
  past: HistorySnapshot[];
  future: HistorySnapshot[];

  // إدارة الملفات والصفحات (المرحلة 2)
  addFiles: (files: File[]) => Promise<void>;
  removeFile: (fileId: string) => void;
  moveFile: (fromIndex: number, toIndex: number) => void;
  applyFilePageRange: (fileId: string, rangeInput: string) => { ok: boolean; error?: string };
  rotatePage: (pageId: string, delta?: 90 | -90) => void;
  rotateAllActivePages: (delta?: 90 | -90) => void;
  toggleDeletePage: (pageId: string) => void;
  restoreAllDeletedPages: () => void;
  reorderActivePages: (fromActiveIndex: number, toActiveIndex: number) => void;

  // المحرر التفاعلي للعناصر (المرحلة 3)
  setMode: (mode: WorkspaceMode) => void;
  openPageInEditor: (pageId: string) => void;
  setActiveEditorPageId: (pageId: string) => void;
  setZoom: (zoom: number) => void;
  selectAnnotation: (annotationId: string | null) => void;
  commitHistoryCheckpoint: () => void;
  addTextAnnotation: (pageId: string, initialText?: string) => string;
  addImageAnnotation: (
    pageId: string,
    payload: {
      type: 'image' | 'signature';
      mimeType: 'image/png' | 'image/jpeg';
      dataUrl: string;
      aspectRatio: number;
      label?: string;
    }
  ) => string;
  updateAnnotation: (
    annotationId: string,
    patch: Partial<TextAnnotation> | Partial<ImageAnnotation>,
    recordHistory?: boolean
  ) => void;
  deleteAnnotation: (annotationId: string) => void;
  duplicateAnnotation: (annotationId: string) => void;
  addSavedSignature: (sig: Omit<SavedSignature, 'id' | 'createdAt'>) => SavedSignature;
  removeSavedSignature: (sigId: string) => void;

  // المرحلة 4: العربية والأداء والذاكرة
  setTextExportMode: (mode: TextExportMode) => void;
  freeThumbnailMemory: () => void;
  cancelExport: () => void;

  // التراجع والتصدير
  undo: () => void;
  redo: () => void;
  setShowDeleted: (show: boolean) => void;
  setOutputFilename: (name: string) => void;
  clearMessages: () => void;
  setError: (msg: string | null) => void;
  exportProject: () => Promise<void>;
  resetProject: () => void;
}

function cloneSnapshot(pages: ProjectPage[], annotations: PageAnnotation[]): HistorySnapshot {
  return {
    pages: pages.map((p) => ({ ...p })),
    annotations: annotations.map((a) => ({ ...a })),
  };
}

function pushHistory(
  past: HistorySnapshot[],
  pages: ProjectPage[],
  annotations: PageAnnotation[]
): HistorySnapshot[] {
  const next = [...past, cloneSnapshot(pages, annotations)];
  if (next.length > PDF_LIMITS.MAX_HISTORY_STEPS) {
    return next.slice(next.length - PDF_LIMITS.MAX_HISTORY_STEPS);
  }
  return next;
}

function normalizeAngle(angle: number): RotationAngle {
  const normalized = ((angle % 360) + 360) % 360;
  if (normalized === 90 || normalized === 180 || normalized === 270) {
    return normalized;
  }
  return 0;
}

function resolveValidEditorPageId(
  pages: ProjectPage[],
  currentId: string | null
): string | null {
  if (currentId && pages.some((p) => p.id === currentId && !p.deleted)) {
    return currentId;
  }
  return pages.find((p) => !p.deleted)?.id ?? null;
}

export const usePdfStore = create<PdfStoreState>((set, get) => ({
  sourceFiles: {},
  fileOrder: [],
  pages: [],
  annotations: [],
  savedSignatures: [],

  mode: 'organize',
  activeEditorPageId: null,
  selectedAnnotationId: null,
  zoom: PDF_LIMITS.DEFAULT_ZOOM,

  textExportMode: 'vector',
  exportProgress: null,
  cacheVersion: 0,

  outputFilename: 'merged-document.pdf',
  showDeleted: false,
  isLoading: false,
  isExporting: false,
  error: null,
  errorDetails: [],
  statusMessage: null,
  past: [],
  future: [],

  addFiles: async (files: File[]) => {
    if (files.length === 0) return;

    set({ isLoading: true, error: null, errorDetails: [], statusMessage: null });

    const state = get();
    const nextSourceFiles = { ...state.sourceFiles };
    const nextFileOrder = [...state.fileOrder];
    const nextPages = [...state.pages];
    const errors: string[] = [];
    let addedFilesCount = 0;

    let currentTotalPages = nextPages.filter((p) => !p.deleted).length;
    let currentMemoryBytes = Object.values(nextSourceFiles).reduce(
      (sum, f) => sum + f.bytes.byteLength,
      0
    );

    for (const file of files) {
      try {
        if (currentMemoryBytes + file.size > PDF_LIMITS.MAX_TOTAL_MEMORY_BYTES) {
          const maxTotalMb = Math.round(PDF_LIMITS.MAX_TOTAL_MEMORY_BYTES / (1024 * 1024));
          errors.push(
            `تجاوز إضافة "${file.name}" الحد الآمن لإجمالي ذاكرة المشروع (${maxTotalMb} ميجابايت).`
          );
          continue;
        }

        const colorIndex = nextFileOrder.length % FILE_COLOR_TAGS.length;
        const loaded = await loadSourcePdf(file, FILE_COLOR_TAGS[colorIndex]);

        if (currentTotalPages + loaded.pageCount > PDF_LIMITS.MAX_TOTAL_PAGES) {
          errors.push(
            `تجاوز إضافة "${file.name}" الحد الأقصى لمجموع الصفحات (${PDF_LIMITS.MAX_TOTAL_PAGES} صفحة).`
          );
          continue;
        }

        nextSourceFiles[loaded.id] = loaded;
        nextFileOrder.push(loaded.id);

        for (let i = 0; i < loaded.pageCount; i++) {
          nextPages.push({
            id: crypto.randomUUID(),
            sourceFileId: loaded.id,
            sourcePageIndex: i,
            rotation: 0,
            deleted: false,
          });
        }

        currentTotalPages += loaded.pageCount;
        currentMemoryBytes += loaded.bytes.byteLength;
        addedFilesCount += 1;
      } catch (err) {
        if (err instanceof PdfProcessingError && err.suggestion) {
          errors.push(`${err.message} (${err.suggestion})`);
        } else {
          errors.push(err instanceof Error ? err.message : `تعذر تحميل "${file.name}".`);
        }
      }
    }

    set({
      sourceFiles: nextSourceFiles,
      fileOrder: nextFileOrder,
      pages: nextPages,
      activeEditorPageId: resolveValidEditorPageId(nextPages, state.activeEditorPageId),
      past:
        addedFilesCount > 0
          ? pushHistory(state.past, state.pages, state.annotations)
          : state.past,
      future: addedFilesCount > 0 ? [] : state.future,
      isLoading: false,
      error: errors.length > 0 ? (errors.length === 1 ? errors[0] : `تعذر تحميل ${errors.length} ملفات:`) : null,
      errorDetails: errors.length > 1 ? errors : [],
      statusMessage:
        addedFilesCount > 0
          ? `تمت إضافة ${addedFilesCount} ${addedFilesCount === 1 ? 'ملف' : 'ملفات'} محلياً بنجاح.`
          : null,
    });
  },

  removeFile: (fileId: string) => {
    const state = get();
    if (!state.sourceFiles[fileId]) return;

    clearFileThumbnailCache(fileId);

    const nextSourceFiles = { ...state.sourceFiles };
    delete nextSourceFiles[fileId];

    const removedPageIds = new Set(
      state.pages.filter((p) => p.sourceFileId === fileId).map((p) => p.id)
    );
    const nextFileOrder = state.fileOrder.filter((id) => id !== fileId);
    const nextPages = state.pages.filter((p) => p.sourceFileId !== fileId);
    const nextAnnotations = state.annotations.filter((a) => !removedPageIds.has(a.pageId));
    const nextEditorPageId = resolveValidEditorPageId(nextPages, state.activeEditorPageId);

    set({
      sourceFiles: nextSourceFiles,
      fileOrder: nextFileOrder,
      pages: nextPages,
      annotations: nextAnnotations,
      activeEditorPageId: nextEditorPageId,
      mode: nextPages.length === 0 ? 'organize' : state.mode,
      selectedAnnotationId: null,
      past: [],
      future: [],
      error: null,
      statusMessage: 'تمت إزالة الملف وتحرير ذاكرته من المتصفح.',
    });
  },

  moveFile: (fromIndex: number, toIndex: number) => {
    const state = get();
    if (
      fromIndex === toIndex ||
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= state.fileOrder.length ||
      toIndex >= state.fileOrder.length
    ) {
      return;
    }

    const nextFileOrder = [...state.fileOrder];
    const [movedId] = nextFileOrder.splice(fromIndex, 1);
    nextFileOrder.splice(toIndex, 0, movedId);

    const pagesByFile = new Map<string, ProjectPage[]>();
    for (const page of state.pages) {
      const list = pagesByFile.get(page.sourceFileId) ?? [];
      list.push(page);
      pagesByFile.set(page.sourceFileId, list);
    }

    const reorderedPages: ProjectPage[] = [];
    for (const fid of nextFileOrder) {
      const group = pagesByFile.get(fid);
      if (group) {
        reorderedPages.push(...group);
      }
    }

    set({
      fileOrder: nextFileOrder,
      pages: reorderedPages,
      past: pushHistory(state.past, state.pages, state.annotations),
      future: [],
      statusMessage: 'تم تحديث ترتيب الملفات والصفحات.',
    });
  },

  applyFilePageRange: (fileId: string, rangeInput: string) => {
    const state = get();
    const source = state.sourceFiles[fileId];
    if (!source) {
      return { ok: false, error: 'الملف غير موجود.' };
    }

    const parsed = parsePageRange(rangeInput, source.pageCount);
    if (!parsed.valid) {
      return { ok: false, error: parsed.error };
    }

    const otherActiveCount = state.pages.filter(
      (p) => p.sourceFileId !== fileId && !p.deleted
    ).length;
    if (otherActiveCount + parsed.indices.length > PDF_LIMITS.MAX_TOTAL_PAGES) {
      return {
        ok: false,
        error: `تجاوز النطاق الحد الأقصى لمجموع الصفحات (${PDF_LIMITS.MAX_TOTAL_PAGES}).`,
      };
    }

    const existingByIndex = new Map<number, ProjectPage>();
    for (const p of state.pages) {
      if (p.sourceFileId === fileId) {
        existingByIndex.set(p.sourcePageIndex, p);
      }
    }

    const updatedFilePages: ProjectPage[] = parsed.indices.map((pageIndex) => {
      const prev = existingByIndex.get(pageIndex);
      return {
        id: prev?.id ?? crypto.randomUUID(),
        sourceFileId: fileId,
        sourcePageIndex: pageIndex,
        rotation: prev?.rotation ?? 0,
        deleted: false,
      };
    });

    const firstPos = state.pages.findIndex((p) => p.sourceFileId === fileId);
    const remainingPages = state.pages.filter((p) => p.sourceFileId !== fileId);

    const insertAt =
      firstPos === -1 ? remainingPages.length : Math.min(firstPos, remainingPages.length);
    const nextPages = [
      ...remainingPages.slice(0, insertAt),
      ...updatedFilePages,
      ...remainingPages.slice(insertAt),
    ];

    const keptPageIds = new Set(nextPages.map((p) => p.id));
    const nextAnnotations = state.annotations.filter((a) => keptPageIds.has(a.pageId));

    set({
      sourceFiles: {
        ...state.sourceFiles,
        [fileId]: { ...source, pageRangeInput: rangeInput.trim() },
      },
      pages: nextPages,
      annotations: nextAnnotations,
      activeEditorPageId: resolveValidEditorPageId(nextPages, state.activeEditorPageId),
      past: pushHistory(state.past, state.pages, state.annotations),
      future: [],
      error: null,
      statusMessage: `تم تطبيق النطاق على "${source.name}" (${updatedFilePages.length} صفحة).`,
    });

    return { ok: true };
  },

  rotatePage: (pageId: string, delta = 90) => {
    const state = get();
    const nextPages = state.pages.map((p) =>
      p.id === pageId ? { ...p, rotation: normalizeAngle(p.rotation + delta) } : p
    );
    set({
      pages: nextPages,
      past: pushHistory(state.past, state.pages, state.annotations),
      future: [],
    });
  },

  rotateAllActivePages: (delta = 90) => {
    const state = get();
    if (!state.pages.some((p) => !p.deleted)) return;

    const nextPages = state.pages.map((p) =>
      p.deleted ? p : { ...p, rotation: normalizeAngle(p.rotation + delta) }
    );
    set({
      pages: nextPages,
      past: pushHistory(state.past, state.pages, state.annotations),
      future: [],
      statusMessage: 'تم تدوير جميع الصفحات النشطة.',
    });
  },

  toggleDeletePage: (pageId: string) => {
    const state = get();
    const nextPages = state.pages.map((p) =>
      p.id === pageId ? { ...p, deleted: !p.deleted } : p
    );
    set({
      pages: nextPages,
      activeEditorPageId: resolveValidEditorPageId(nextPages, state.activeEditorPageId),
      past: pushHistory(state.past, state.pages, state.annotations),
      future: [],
    });
  },

  restoreAllDeletedPages: () => {
    const state = get();
    if (!state.pages.some((p) => p.deleted)) return;

    const nextPages = state.pages.map((p) => (p.deleted ? { ...p, deleted: false } : p));
    set({
      pages: nextPages,
      activeEditorPageId: resolveValidEditorPageId(nextPages, state.activeEditorPageId),
      past: pushHistory(state.past, state.pages, state.annotations),
      future: [],
      statusMessage: 'تمت استعادة جميع الصفحات المحذوفة.',
    });
  },

  reorderActivePages: (fromActiveIndex: number, toActiveIndex: number) => {
    const state = get();
    if (fromActiveIndex === toActiveIndex) return;

    const visiblePages = state.showDeleted
      ? state.pages
      : state.pages.filter((p) => !p.deleted);

    if (
      fromActiveIndex < 0 ||
      toActiveIndex < 0 ||
      fromActiveIndex >= visiblePages.length ||
      toActiveIndex >= visiblePages.length
    ) {
      return;
    }

    const fromId = visiblePages[fromActiveIndex].id;
    const toId = visiblePages[toActiveIndex].id;

    const actualFrom = state.pages.findIndex((p) => p.id === fromId);
    const actualTo = state.pages.findIndex((p) => p.id === toId);
    if (actualFrom === -1 || actualTo === -1) return;

    const nextPages = [...state.pages];
    const [moved] = nextPages.splice(actualFrom, 1);
    nextPages.splice(actualTo, 0, moved);

    set({
      pages: nextPages,
      past: pushHistory(state.past, state.pages, state.annotations),
      future: [],
    });
  },

  // --- المرحلة 3: المحرر التفاعلي ---

  setMode: (mode: WorkspaceMode) => {
    const state = get();
    if (mode === 'editor') {
      const targetPageId = resolveValidEditorPageId(state.pages, state.activeEditorPageId);
      if (!targetPageId) return;
      set({ mode: 'editor', activeEditorPageId: targetPageId, selectedAnnotationId: null });
    } else {
      set({ mode: 'organize', selectedAnnotationId: null });
    }
  },

  openPageInEditor: (pageId: string) => {
    const state = get();
    const target = state.pages.find((p) => p.id === pageId && !p.deleted);
    if (!target) return;
    set({
      mode: 'editor',
      activeEditorPageId: target.id,
      selectedAnnotationId: null,
    });
  },

  setActiveEditorPageId: (pageId: string) => {
    set({ activeEditorPageId: pageId, selectedAnnotationId: null });
  },

  setZoom: (zoom: number) => {
    const clamped = Math.max(
      PDF_LIMITS.MIN_ZOOM,
      Math.min(PDF_LIMITS.MAX_ZOOM, Math.round(zoom * 100) / 100)
    );
    set({ zoom: clamped });
  },

  selectAnnotation: (annotationId: string | null) => {
    set({ selectedAnnotationId: annotationId });
  },

  commitHistoryCheckpoint: () => {
    const state = get();
    set({
      past: pushHistory(state.past, state.pages, state.annotations),
      future: [],
    });
  },

  addTextAnnotation: (pageId: string, initialText = 'أكتب النص هنا') => {
    const state = get();
    const existingOnPage = state.annotations.filter((a) => a.pageId === pageId).length;
    const offset = (existingOnPage % 5) * 0.035;

    const id = crypto.randomUUID();
    const box = clampNormalizedBox({
      xRatio: 0.32 + offset,
      yRatio: 0.22 + offset,
      widthRatio: 0.36,
      heightRatio: 0.08,
    });

    const newAnnotation: TextAnnotation = {
      id,
      pageId,
      type: 'text',
      ...box,
      content: initialText,
      fontSize: 18,
      colorHex: '#0f172a',
      bold: false,
      align: 'right',
      backgroundColor: 'transparent',
      opacity: 1,
    };

    set({
      annotations: [...state.annotations, newAnnotation],
      selectedAnnotationId: id,
      past: pushHistory(state.past, state.pages, state.annotations),
      future: [],
    });

    return id;
  },

  addImageAnnotation: (pageId, payload) => {
    const state = get();
    const existingOnPage = state.annotations.filter((a) => a.pageId === pageId).length;
    const offset = (existingOnPage % 4) * 0.03;

    const isSignature = payload.type === 'signature';
    const defaultWidthRatio = isSignature ? 0.28 : 0.34;
    const estimatedHeightRatio = Math.min(
      0.45,
      Math.max(0.06, (defaultWidthRatio / Math.max(0.25, payload.aspectRatio)) * 0.72)
    );

    const box = clampNormalizedBox({
      xRatio: isSignature ? 0.62 - offset : 0.3 + offset,
      yRatio: isSignature ? 0.76 - offset : 0.28 + offset,
      widthRatio: defaultWidthRatio,
      heightRatio: estimatedHeightRatio,
    });

    const id = crypto.randomUUID();
    const newAnnotation: ImageAnnotation = {
      id,
      pageId,
      type: payload.type,
      mimeType: payload.mimeType,
      dataUrl: payload.dataUrl,
      aspectRatio: payload.aspectRatio,
      label: payload.label,
      ...box,
      opacity: 1,
    };

    set({
      annotations: [...state.annotations, newAnnotation],
      selectedAnnotationId: id,
      past: pushHistory(state.past, state.pages, state.annotations),
      future: [],
      statusMessage: isSignature
        ? 'تمت إضافة التوقيع على الصفحة.'
        : 'تمت إضافة الصورة على الصفحة.',
    });

    return id;
  },

  updateAnnotation: (annotationId, patch, recordHistory = false) => {
    const state = get();
    const nextAnnotations = state.annotations.map((ann) => {
      if (ann.id !== annotationId) return ann;
      const merged = { ...ann, ...patch } as PageAnnotation;
      const clamped = clampNormalizedBox({
        xRatio: merged.xRatio,
        yRatio: merged.yRatio,
        widthRatio: merged.widthRatio,
        heightRatio: merged.heightRatio,
      });
      return { ...merged, ...clamped };
    });

    set({
      annotations: nextAnnotations,
      past: recordHistory
        ? pushHistory(state.past, state.pages, state.annotations)
        : state.past,
      future: recordHistory ? [] : state.future,
    });
  },

  deleteAnnotation: (annotationId: string) => {
    const state = get();
    if (!state.annotations.some((a) => a.id === annotationId)) return;

    set({
      annotations: state.annotations.filter((a) => a.id !== annotationId),
      selectedAnnotationId:
        state.selectedAnnotationId === annotationId ? null : state.selectedAnnotationId,
      past: pushHistory(state.past, state.pages, state.annotations),
      future: [],
    });
  },

  duplicateAnnotation: (annotationId: string) => {
    const state = get();
    const target = state.annotations.find((a) => a.id === annotationId);
    if (!target) return;

    const id = crypto.randomUUID();
    const box = clampNormalizedBox({
      xRatio: target.xRatio + 0.03,
      yRatio: target.yRatio + 0.03,
      widthRatio: target.widthRatio,
      heightRatio: target.heightRatio,
    });

    const copy: PageAnnotation = {
      ...target,
      ...box,
      id,
    };

    set({
      annotations: [...state.annotations, copy],
      selectedAnnotationId: id,
      past: pushHistory(state.past, state.pages, state.annotations),
      future: [],
    });
  },

  addSavedSignature: (sig) => {
    const saved: SavedSignature = {
      ...sig,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    };
    set((state) => ({
      savedSignatures: [saved, ...state.savedSignatures].slice(0, 6),
    }));
    return saved;
  },

  removeSavedSignature: (sigId: string) => {
    set((state) => ({
      savedSignatures: state.savedSignatures.filter((s) => s.id !== sigId),
    }));
  },

  // --- المرحلة 4: العربية والأداء والذاكرة ---

  setTextExportMode: (textExportMode: TextExportMode) => {
    set({
      textExportMode,
      statusMessage:
        textExportMode === 'vector'
          ? 'تم تفعيل تصدير النص العربي كخط متجه (TTF) قابل للتحديد والبحث.'
          : 'تم تفعيل تصدير النص كصورة عالية الدقة (Raster).',
    });
  },

  freeThumbnailMemory: () => {
    purgeThumbnailCache();
    set((state) => ({
      cacheVersion: state.cacheVersion + 1,
      statusMessage: 'تم تفريغ كاش المصغرات وتحرير ذاكرة المعاينة بنجاح.',
    }));
  },

  cancelExport: () => {
    cancelActiveExport();
    set({
      isExporting: false,
      exportProgress: null,
      statusMessage: 'تم إلغاء عملية التصدير.',
    });
  },

  undo: () => {
    const state = get();
    if (state.past.length === 0) return;
    const previous = state.past[state.past.length - 1];
    const nextPast = state.past.slice(0, -1);

    set({
      pages: previous.pages,
      annotations: previous.annotations,
      activeEditorPageId: resolveValidEditorPageId(previous.pages, state.activeEditorPageId),
      selectedAnnotationId: null,
      past: nextPast,
      future: [cloneSnapshot(state.pages, state.annotations), ...state.future],
    });
  },

  redo: () => {
    const state = get();
    if (state.future.length === 0) return;
    const next = state.future[0];
    const nextFuture = state.future.slice(1);

    set({
      pages: next.pages,
      annotations: next.annotations,
      activeEditorPageId: resolveValidEditorPageId(next.pages, state.activeEditorPageId),
      selectedAnnotationId: null,
      past: pushHistory(state.past, state.pages, state.annotations),
      future: nextFuture,
    });
  },

  setShowDeleted: (show: boolean) => set({ showDeleted: show }),
  setOutputFilename: (name: string) => set({ outputFilename: name }),
  clearMessages: () => set({ error: null, errorDetails: [], statusMessage: null }),
  setError: (msg: string | null) => set({ error: msg, errorDetails: [] }),

  exportProject: async () => {
    const state = get();
    if (state.isExporting) return;

    set({
      isExporting: true,
      error: null,
      statusMessage: null,
      exportProgress: { percent: 2, stage: 'جارٍ تحضير مهمة المعالجة في الخلفية...' },
    });

    try {
      const mergedBytes = await exportPdfInWorker(
        state.sourceFiles,
        state.pages,
        state.annotations,
        {
          textExportMode: state.textExportMode,
          onProgress: (progress) => set({ exportProgress: progress }),
        }
      );

      triggerPdfDownload(mergedBytes, state.outputFilename);
      set({
        isExporting: false,
        exportProgress: null,
        statusMessage: 'تم إنشاء الملف الناتج في الخلفية وتنزيله بنجاح.',
      });
    } catch (err) {
      if (err instanceof Error && err.message === 'EXPORT_CANCELLED') {
        return;
      }
      set({
        isExporting: false,
        exportProgress: null,
        error: err instanceof Error ? err.message : 'حدث خطأ أثناء تصدير الملف.',
      });
    }
  },

  resetProject: () => {
    cancelActiveExport();
    clearAllThumbnailCaches();
    set({
      sourceFiles: {},
      fileOrder: [],
      pages: [],
      annotations: [],
      mode: 'organize',
      activeEditorPageId: null,
      selectedAnnotationId: null,
      zoom: PDF_LIMITS.DEFAULT_ZOOM,
      exportProgress: null,
      isExporting: false,
      outputFilename: 'merged-document.pdf',
      showDeleted: false,
      error: null,
      statusMessage: null,
      past: [],
      future: [],
    });
  },
}));
