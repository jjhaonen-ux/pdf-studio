import type { SourcePdfFile } from '@/types/pdf';
import { PDF_LIMITS } from './limits';

type PdfJsLib = typeof import('pdfjs-dist');
type PdfDocumentProxy = import('pdfjs-dist').PDFDocumentProxy;
type PdfRenderTask = import('pdfjs-dist').RenderTask;

let pdfjsPromise: Promise<PdfJsLib> | null = null;
const docProxyCache = new Map<string, Promise<PdfDocumentProxy>>();

/**
 * كاش LRU للمصغرات يستخدم Object URLs بدلاً من Base64 لتقليل استهلاك ذاكرة JS بشكل كبير
 */
const thumbnailUrlLru = new Map<string, { url: string; approxBytes: number }>();
const inflightRenders = new Map<string, Promise<string>>();

/** طابور تحديد التزامن لمنع إنشاء عشرات الـ Canvas في وقت واحد مع الملفات الكبيرة */
let activeRenderCount = 0;
const renderWaitQueue: (() => void)[] = [];

async function acquireRenderSlot(): Promise<void> {
  if (activeRenderCount < PDF_LIMITS.MAX_CONCURRENT_THUMBNAIL_RENDERS) {
    activeRenderCount += 1;
    return;
  }
  await new Promise<void>((resolve) => {
    renderWaitQueue.push(resolve);
  });
  activeRenderCount += 1;
}

function releaseRenderSlot(): void {
  activeRenderCount = Math.max(0, activeRenderCount - 1);
  const next = renderWaitQueue.shift();
  if (next) next();
}

function setLruThumbnail(key: string, url: string, approxBytes: number): void {
  if (thumbnailUrlLru.has(key)) {
    const prev = thumbnailUrlLru.get(key)!;
    if (prev.url !== url && prev.url.startsWith('blob:')) {
      URL.revokeObjectURL(prev.url);
    }
    thumbnailUrlLru.delete(key);
  }

  thumbnailUrlLru.set(key, { url, approxBytes });

  // إخلاء أقدم المصغرات تلقائياً عند تجاوز الحد الأقصى مع تحرير Object URL فوراً
  while (thumbnailUrlLru.size > PDF_LIMITS.MAX_THUMBNAIL_CACHE_ENTRIES) {
    const oldestKey = thumbnailUrlLru.keys().next().value;
    if (!oldestKey) break;
    const evicted = thumbnailUrlLru.get(oldestKey);
    if (evicted?.url.startsWith('blob:')) {
      URL.revokeObjectURL(evicted.url);
    }
    thumbnailUrlLru.delete(oldestKey);
  }
}

function getLruThumbnail(key: string): string | undefined {
  const entry = thumbnailUrlLru.get(key);
  if (!entry) return undefined;
  // تحديث الترتيب لجعله الأحدث استخداماً
  thumbnailUrlLru.delete(key);
  thumbnailUrlLru.set(key, entry);
  return entry.url;
}

async function getPdfJs(): Promise<PdfJsLib> {
  if (typeof window === 'undefined') {
    throw new Error('لا يمكن عرض صفحات PDF إلا داخل المتصفح.');
  }

  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist').then((pdfjsLib) => {
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url
      ).toString();
      return pdfjsLib;
    });
  }

  return pdfjsPromise;
}

export async function getPdfDocumentProxy(
  sourceFile: SourcePdfFile
): Promise<PdfDocumentProxy> {
  let cached = docProxyCache.get(sourceFile.id);
  if (!cached) {
    cached = (async () => {
      const pdfjsLib = await getPdfJs();
      // نمرر نسخة عبر slice() لأن PDF.js ينقل ArrayBuffer إلى Worker مما يفرغ المصفوفة الأصلية
      const loadingTask = pdfjsLib.getDocument({
        data: sourceFile.bytes.slice(),
        useSystemFonts: true,
      });
      return loadingTask.promise;
    })();
    docProxyCache.set(sourceFile.id, cached);
  }
  return cached;
}

function canvasToObjectUrl(
  canvas: HTMLCanvasElement
): Promise<{ url: string; bytes: number }> {
  return new Promise((resolve) => {
    if (typeof canvas.toBlob === 'function') {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve({ url: URL.createObjectURL(blob), bytes: blob.size });
          } else {
            const fallback = canvas.toDataURL('image/jpeg', 0.8);
            resolve({ url: fallback, bytes: fallback.length });
          }
        },
        'image/jpeg',
        0.8
      );
    } else {
      const fallback = canvas.toDataURL('image/jpeg', 0.8);
      resolve({ url: fallback, bytes: fallback.length });
    }
  });
}

/**
 * توليد مصغّرة لصورة صفحة محددة مع كاش LRU وتقييد التزامن لحماية الذاكرة
 */
export async function renderPageThumbnail(
  sourceFile: SourcePdfFile,
  pageIndex: number,
  targetWidth = 260
): Promise<string> {
  const cacheKey = `${sourceFile.id}:${pageIndex}:${targetWidth}`;
  const existing = getLruThumbnail(cacheKey);
  if (existing) {
    return existing;
  }

  const inflight = inflightRenders.get(cacheKey);
  if (inflight) {
    return inflight;
  }

  const renderTask = (async () => {
    await acquireRenderSlot();
    try {
      const again = getLruThumbnail(cacheKey);
      if (again) return again;

      const pdfDoc = await getPdfDocumentProxy(sourceFile);
      const page = await pdfDoc.getPage(pageIndex + 1);
      const baseViewport = page.getViewport({ scale: 1 });
      const scale = Math.max(0.2, Math.min(1.4, targetWidth / baseViewport.width));
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);

      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('تعذر تهيئة سياق الرسم للمصغّرة.');
      }

      await page.render({
        canvasContext: context,
        viewport,
      }).promise;

      const { url, bytes } = await canvasToObjectUrl(canvas);
      setLruThumbnail(cacheKey, url, bytes);

      // تحرير ذاكرة canvas وصفحة PDF.js فوراً
      canvas.width = 0;
      canvas.height = 0;
      page.cleanup();

      return url;
    } finally {
      releaseRenderSlot();
      inflightRenders.delete(cacheKey);
    }
  })();

  inflightRenders.set(cacheKey, renderTask);
  return renderTask;
}

export interface EditorCanvasRenderResult {
  pdfWidthPt: number;
  pdfHeightPt: number;
  displayWidthPx: number;
  displayHeightPx: number;
  cancel: () => void;
}

/**
 * رسم صفحة PDF بدقة عالية داخل عنصر Canvas للمحرر التفاعلي مع دعم التكبير والتدوير
 */
export async function renderPageToEditorCanvas(
  sourceFile: SourcePdfFile,
  pageIndex: number,
  userRotation: number,
  zoom: number,
  canvas: HTMLCanvasElement,
  onTaskCreated?: (task: PdfRenderTask) => void
): Promise<Omit<EditorCanvasRenderResult, 'cancel'>> {
  const pdfDoc = await getPdfDocumentProxy(sourceFile);
  const page = await pdfDoc.getPage(pageIndex + 1);

  const totalRotation = ((page.rotate + userRotation) % 360 + 360) % 360;
  const baseViewport = page.getViewport({ scale: 1, rotation: totalRotation });
  const displayViewport = page.getViewport({ scale: zoom, rotation: totalRotation });

  const dpr = Math.min(window.devicePixelRatio || 1, 2.25);
  const renderViewport = page.getViewport({
    scale: zoom * dpr,
    rotation: totalRotation,
  });

  canvas.width = Math.floor(renderViewport.width);
  canvas.height = Math.floor(renderViewport.height);
  canvas.style.width = `${Math.floor(displayViewport.width)}px`;
  canvas.style.height = `${Math.floor(displayViewport.height)}px`;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('تعذر تهيئة سياق الرسم للمحرر.');
  }

  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);

  const task = page.render({
    canvasContext: context,
    viewport: renderViewport,
  });

  onTaskCreated?.(task);
  await task.promise;

  return {
    pdfWidthPt: baseViewport.width,
    pdfHeightPt: baseViewport.height,
    displayWidthPx: Math.floor(displayViewport.width),
    displayHeightPx: Math.floor(displayViewport.height),
  };
}

/** إحصائيات كاش المصغرات لمراقبة الذاكرة */
export function getThumbnailCacheStats(): {
  entries: number;
  maxEntries: number;
  approxBytes: number;
} {
  let approxBytes = 0;
  for (const item of Array.from(thumbnailUrlLru.values())) {
    approxBytes += item.approxBytes;
  }
  return {
    entries: thumbnailUrlLru.size,
    maxEntries: PDF_LIMITS.MAX_THUMBNAIL_CACHE_ENTRIES,
    approxBytes,
  };
}

/** تفريغ كاش المصغرات يدوياً لتحرير الذاكرة دون حذف الملفات الأصلية */
export function purgeThumbnailCache(): void {
  for (const item of Array.from(thumbnailUrlLru.values())) {
    if (item.url.startsWith('blob:')) {
      URL.revokeObjectURL(item.url);
    }
  }
  thumbnailUrlLru.clear();
}

/** تنظيف الذاكرة عند إزالة ملف من المشروع */
export function clearFileThumbnailCache(fileId: string): void {
  const docPromise = docProxyCache.get(fileId);
  if (docPromise) {
    docPromise.then((doc) => doc.destroy()).catch(() => {});
    docProxyCache.delete(fileId);
  }

  for (const [key, item] of Array.from(thumbnailUrlLru.entries())) {
    if (key.startsWith(`${fileId}:`)) {
      if (item.url.startsWith('blob:')) {
        URL.revokeObjectURL(item.url);
      }
      thumbnailUrlLru.delete(key);
    }
  }
}

export function clearAllThumbnailCaches(): void {
  for (const fileId of Array.from(docProxyCache.keys())) {
    clearFileThumbnailCache(fileId);
  }
  purgeThumbnailCache();
}
