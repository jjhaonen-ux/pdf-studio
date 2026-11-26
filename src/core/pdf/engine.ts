import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type {
  ExportProgressEvent,
  PageAnnotation,
  ProjectPage,
  SourcePdfFile,
  TextAnnotation,
  TextExportMode,
} from '@/types/pdf';
import { inspectPdfBytes, validatePdfFile, verifyExportedPdf } from './validator';
import { classifyPdfError, PdfProcessingError } from './errors';
import {
  localPointToPdfPoint,
  normalizeRotation,
  visualBoxToPdfPlacement,
} from './coordinates';
import { dataUrlToBytes } from './imageUtils';
import { renderTextAnnotationToPng } from './textRenderer';
import { hasArabicCharacters, prepareVectorLineForPdf } from './arabicText';
import { loadArabicFontBundle, type ArabicFontBundle } from './fontLoader';

export interface ExportPdfOptions {
  textExportMode?: TextExportMode;
  fontBundle?: ArabicFontBundle | null;
  /** خريطة اختيارية لنصوص مُصيَّرة مسبقاً كـ PNG (تُستخدم عند التصدير بوضع raster داخل Worker) */
  preRenderedTextPngs?: Record<string, Uint8Array>;
  onProgress?: (event: ExportProgressEvent) => void;
}

function hexToRgbColor(hex: string) {
  const cleaned = hex.replace('#', '').trim();
  if (cleaned.length !== 6) return rgb(0.06, 0.09, 0.16);
  const r = parseInt(cleaned.slice(0, 2), 16) / 255;
  const g = parseInt(cleaned.slice(2, 4), 16) / 255;
  const b = parseInt(cleaned.slice(4, 6), 16) / 255;
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
    return rgb(0.06, 0.09, 0.16);
  }
  return rgb(r, g, b);
}

/** قراءة ملف محلي والتحقق من بنيته وسلامته ثم تحويله إلى SourcePdfFile */
export async function loadSourcePdf(
  file: File,
  colorTag: string
): Promise<SourcePdfFile> {
  const validation = await validatePdfFile(file);
  if (!validation.valid) {
    throw new PdfProcessingError('INVALID_HEADER', validation.error ?? 'ملف غير صالح.', {
      fileName: file.name,
    });
  }

  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  const inspection = inspectPdfBytes(bytes, file.name);
  if (!inspection.valid) {
    throw new PdfProcessingError(
      inspection.code ?? 'CORRUPTED_PDF',
      inspection.error ?? `تعذر قراءة "${file.name}".`,
      { fileName: file.name }
    );
  }

  try {
    const pdfDoc = await PDFDocument.load(bytes, {
      ignoreEncryption: false,
    });

    const pageCount = pdfDoc.getPageCount();
    if (pageCount <= 0) {
      throw new PdfProcessingError(
        'ZERO_PAGES',
        `الملف "${file.name}" لا يحتوي على أي صفحات قابلة للعرض.`,
        { fileName: file.name }
      );
    }

    return {
      id: crypto.randomUUID(),
      name: file.name,
      sizeBytes: file.size,
      pageCount,
      bytes,
      pageRangeInput: '',
      colorTag,
    };
  } catch (err) {
    throw classifyPdfError(err, file.name);
  }
}

/**
 * تقسيم نص منطقي إلى أسطر بناءً على العرض الفعلي لحروف خط TTF المضمّن
 */
function wrapLogicalTextForPdfFont(
  text: string,
  font: import('pdf-lib').PDFFont,
  fontSize: number,
  maxWidthPt: number,
  baseDir: 'rtl' | 'ltr'
): string[] {
  const lines: string[] = [];
  const paragraphs = text.split(/\r?\n/);

  const measureLine = (logical: string): number => {
    const visual = prepareVectorLineForPdf(logical, baseDir);
    try {
      return font.widthOfTextAtSize(visual, fontSize);
    } catch {
      return logical.length * fontSize * 0.55;
    }
  };

  for (const para of paragraphs) {
    if (!para) {
      lines.push('');
      continue;
    }

    const words = para.split(/\s+/);
    let currentLine = '';

    for (const word of words) {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      if (measureLine(candidate) <= maxWidthPt || !currentLine) {
        currentLine = candidate;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }
  }

  return lines;
}

/**
 * رسم نص متجه قابل للتحديد والبحث داخل صفحة PDF مع دعم العربية (تشكيل + BiDi)
 * وجميع زوايا التدوير والمحاذاة والخلفية الاختيارية.
 */
function drawVectorTextAnnotation(
  page: import('pdf-lib').PDFPage,
  annotation: TextAnnotation,
  placement: ReturnType<typeof visualBoxToPdfPlacement>,
  font: import('pdf-lib').PDFFont
): void {
  if (annotation.backgroundColor && annotation.backgroundColor !== 'transparent') {
    page.drawRectangle({
      x: placement.x,
      y: placement.y,
      width: placement.width,
      height: placement.height,
      rotate: degrees(placement.rotateDegrees),
      color: hexToRgbColor(annotation.backgroundColor),
      opacity: annotation.opacity,
    });
  }

  const padding = 4;
  const usableWidth = Math.max(12, placement.width - padding * 2);
  const lineHeight = annotation.fontSize * 1.35;
  const baseDir: 'rtl' | 'ltr' =
    hasArabicCharacters(annotation.content) || annotation.align === 'right' ? 'rtl' : 'ltr';

  const logicalLines = wrapLogicalTextForPdfFont(
    annotation.content,
    font,
    annotation.fontSize,
    usableWidth,
    baseDir
  );

  const textColor = hexToRgbColor(annotation.colorHex);

  for (let i = 0; i < logicalLines.length; i++) {
    const logicalLine = logicalLines[i];
    if (!logicalLine) continue;

    const baselineFromTop = padding + i * lineHeight + annotation.fontSize * 0.88;
    const localY = placement.height - baselineFromTop;
    if (localY < -annotation.fontSize * 0.3) break;

    const visualLine = prepareVectorLineForPdf(logicalLine, baseDir);
    let lineWidth = 0;
    try {
      lineWidth = font.widthOfTextAtSize(visualLine, annotation.fontSize);
    } catch {
      continue;
    }

    let localX = padding;
    if (annotation.align === 'right') {
      localX = Math.max(padding, placement.width - padding - lineWidth);
    } else if (annotation.align === 'center') {
      localX = Math.max(padding, (placement.width - lineWidth) / 2);
    }

    const pt = localPointToPdfPoint(placement, localX, localY);

    page.drawText(visualLine, {
      x: pt.x,
      y: pt.y,
      size: annotation.fontSize,
      font,
      color: textColor,
      opacity: annotation.opacity,
      rotate: degrees(placement.rotateDegrees),
    });
  }
}

/**
 * تنفيذ عمليات الدمج وإعادة الترتيب والتدوير ورسم العناصر المضافة دفعة واحدة
 * ثم التحقق من سلامة الملف الناتج قبل إرجاعه للتنزيل.
 */
export async function exportMergedPdf(
  sourceFiles: Record<string, SourcePdfFile>,
  pages: ProjectPage[],
  annotations: PageAnnotation[] = [],
  options: ExportPdfOptions = {}
): Promise<Uint8Array> {
  const { textExportMode = 'vector', preRenderedTextPngs, onProgress } = options;

  const activePages = pages.filter((p) => !p.deleted);
  if (activePages.length === 0) {
    throw new PdfProcessingError('NO_ACTIVE_PAGES', 'لا توجد صفحات نشطة للتصدير.');
  }

  onProgress?.({
    percent: 5,
    stage: 'جارٍ تهيئة المستند الناتج...',
    currentPage: 0,
    totalPages: activePages.length,
  });

  const outputPdf = await PDFDocument.create();
  outputPdf.registerFontkit(fontkit);

  const hasTextAnnotations = annotations.some((a) => a.type === 'text');
  let arabicRegularFont: import('pdf-lib').PDFFont | null = null;
  let arabicBoldFont: import('pdf-lib').PDFFont | null = null;

  if (hasTextAnnotations && textExportMode === 'vector') {
    onProgress?.({
      percent: 12,
      stage: 'جارٍ تضمين الخط العربي المتجه...',
      currentPage: 0,
      totalPages: activePages.length,
    });

    try {
      const bundle = options.fontBundle ?? (await loadArabicFontBundle());
      const needsRegular = annotations.some((a) => a.type === 'text' && !a.bold);
      const needsBold = annotations.some((a) => a.type === 'text' && a.bold);

      if (needsRegular) {
        arabicRegularFont = await outputPdf.embedFont(bundle.regular, { subset: true });
      }
      if (needsBold) {
        arabicBoldFont = await outputPdf.embedFont(bundle.bold, { subset: true });
      }
    } catch {
      arabicRegularFont = null;
      arabicBoldFont = null;
    }
  }

  const loadedDocsCache = new Map<string, PDFDocument>();
  const embeddedImagesCache = new Map<string, import('pdf-lib').PDFImage>();

  const annotationsByPage = new Map<string, PageAnnotation[]>();
  for (const ann of annotations) {
    const list = annotationsByPage.get(ann.pageId) ?? [];
    list.push(ann);
    annotationsByPage.set(ann.pageId, list);
  }

  let exportedPagesCount = 0;

  for (let idx = 0; idx < activePages.length; idx++) {
    const pageRef = activePages[idx];
    const source = sourceFiles[pageRef.sourceFileId];
    if (!source) continue;

    const progressPercent = Math.min(
      86,
      15 + Math.round(((idx + 1) / activePages.length) * 71)
    );
    onProgress?.({
      percent: progressPercent,
      stage: `جارٍ معالجة الصفحة ${idx + 1} من ${activePages.length}...`,
      currentPage: idx + 1,
      totalPages: activePages.length,
    });

    let srcDoc = loadedDocsCache.get(source.id);
    if (!srcDoc) {
      srcDoc = await PDFDocument.load(source.bytes);
      loadedDocsCache.set(source.id, srcDoc);
    }

    const [copiedPage] = await outputPdf.copyPages(srcDoc, [pageRef.sourcePageIndex]);

    const originalAngle = copiedPage.getRotation().angle;
    const totalRotation = normalizeRotation(originalAngle + pageRef.rotation);
    if (pageRef.rotation !== 0) {
      copiedPage.setRotation(degrees(totalRotation));
    }

    const pageAnnotations = annotationsByPage.get(pageRef.id) ?? [];
    if (pageAnnotations.length > 0) {
      const mediaBox = copiedPage.getMediaBox();

      for (const ann of pageAnnotations) {
        const placement = visualBoxToPdfPlacement(ann, mediaBox, totalRotation);

        if (ann.type === 'text') {
          if (!ann.content.trim() && ann.backgroundColor === 'transparent') {
            continue;
          }

          if (textExportMode === 'vector') {
            const chosenFont = ann.bold
              ? (arabicBoldFont ?? arabicRegularFont)
              : (arabicRegularFont ?? arabicBoldFont);

            if (chosenFont) {
              try {
                drawVectorTextAnnotation(copiedPage, ann, placement, chosenFont);
                continue;
              } catch {
                // تحول احتياطي للرسم إذا وُجدت رموز خارج جدول الخط
              }
            }
          }

          const pngBytes =
            preRenderedTextPngs?.[ann.id] ??
            renderTextAnnotationToPng(ann, placement.width, placement.height);

          if (pngBytes) {
            const textImg = await outputPdf.embedPng(pngBytes);
            copiedPage.drawImage(textImg, {
              x: placement.x,
              y: placement.y,
              width: placement.width,
              height: placement.height,
              rotate: degrees(placement.rotateDegrees),
              opacity: ann.opacity,
            });
          } else {
            const fallbackFont = await outputPdf.embedFont(
              ann.bold ? StandardFonts.HelveticaBold : StandardFonts.Helvetica
            );
            const safeText = ann.content.replace(/[^\x20-\x7E]/g, '?');
            copiedPage.drawText(safeText, {
              x: placement.x + 4,
              y: placement.y + Math.max(4, placement.height - ann.fontSize - 4),
              size: ann.fontSize,
              font: fallbackFont,
              color: hexToRgbColor(ann.colorHex),
              opacity: ann.opacity,
              rotate: degrees(placement.rotateDegrees),
            });
          }
        } else {
          let embeddedImg = embeddedImagesCache.get(ann.dataUrl);
          if (!embeddedImg) {
            const imgBytes = dataUrlToBytes(ann.dataUrl);
            embeddedImg =
              ann.mimeType === 'image/jpeg'
                ? await outputPdf.embedJpg(imgBytes)
                : await outputPdf.embedPng(imgBytes);
            embeddedImagesCache.set(ann.dataUrl, embeddedImg);
          }

          copiedPage.drawImage(embeddedImg, {
            x: placement.x,
            y: placement.y,
            width: placement.width,
            height: placement.height,
            rotate: degrees(placement.rotateDegrees),
            opacity: ann.opacity,
          });
        }
      }
    }

    outputPdf.addPage(copiedPage);
    exportedPagesCount += 1;
  }

  onProgress?.({
    percent: 91,
    stage: 'جارٍ حفظ وضغط ملف PDF النهائي...',
    currentPage: exportedPagesCount,
    totalPages: activePages.length,
  });

  const savedBytes = await outputPdf.save({ useObjectStreams: true });

  onProgress?.({
    percent: 96,
    stage: 'جارٍ التحقق من سلامة الملف الناتج قبل التنزيل...',
    currentPage: exportedPagesCount,
    totalPages: activePages.length,
  });

  await verifyExportedPdf(savedBytes, exportedPagesCount);

  onProgress?.({
    percent: 100,
    stage: 'تم التحقق واكتمل التصدير بنجاح!',
    currentPage: exportedPagesCount,
    totalPages: activePages.length,
  });

  return savedBytes;
}

/** تنزيل الملف الناتج في المتصفح دون إرساله لأي خادم */
export function triggerPdfDownload(bytes: Uint8Array, filename = 'merged.pdf'): void {
  const safeName = filename.trim() || 'merged';
  const finalName = safeName.toLowerCase().endsWith('.pdf') ? safeName : `${safeName}.pdf`;
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = finalName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/** تنسيق حجم الملف بصيغة مقروءة بالعربية */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} بايت`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} ك.ب`;
  return `${(kb / 1024).toFixed(2)} م.ب`;
}
