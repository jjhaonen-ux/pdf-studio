import type { TextAnnotation } from '@/types/pdf';
import { dataUrlToBytes } from './imageUtils';

const ARABIC_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;
const NON_WINANSI_REGEX = /[^\x20-\x7E\u00A0-\u00FF\r\n\t]/;

export function containsArabic(text: string): boolean {
  return ARABIC_REGEX.test(text);
}

export function needsUnicodeRenderer(text: string): boolean {
  return NON_WINANSI_REGEX.test(text);
}

/**
 * تقسيم النص إلى أسطر متوافقة مع عرض مربع النص
 */
function wrapParagraphLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidthPx: number
): string[] {
  const lines: string[] = [];
  const paragraphs = text.split(/\r?\n/);

  for (const para of paragraphs) {
    if (!para) {
      lines.push('');
      continue;
    }

    const words = para.split(/\s+/);
    let currentLine = '';

    for (const word of words) {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidthPx || !currentLine) {
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
 * تحويل عنصر النص إلى صورة PNG عالية الدقة (3x) باستخدام محرك المتصفح الأصلي
 * مما يضمن مطابقة تامة للتشكيل واتجاه العربية (RTL) والخطوط والألوان عند التصدير.
 */
export function renderTextAnnotationToPng(
  annotation: TextAnnotation,
  widthPt: number,
  heightPt: number
): Uint8Array | null {
  if (typeof document === 'undefined') {
    return null;
  }

  const scale = 3; // دقة عالية (216 DPI) لوضوح ممتاز عند التكبير والطباعة
  const canvasWidth = Math.max(12, Math.ceil(widthPt * scale));
  const canvasHeight = Math.max(12, Math.ceil(heightPt * scale));

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.scale(scale, scale);

  // رسم خلفية اختيارية (مثل التغطية باللون الأبيض)
  if (annotation.backgroundColor && annotation.backgroundColor !== 'transparent') {
    ctx.fillStyle = annotation.backgroundColor;
    ctx.fillRect(0, 0, widthPt, heightPt);
  }

  const padding = 4;
  const usableWidth = Math.max(10, widthPt - padding * 2);
  const fontWeight = annotation.bold ? '700' : '400';
  const fontFamily =
    '"IBM Plex Sans Arabic", "Segoe UI", Tahoma, Arial, sans-serif';

  ctx.font = `${fontWeight} ${annotation.fontSize}px ${fontFamily}`;
  ctx.fillStyle = annotation.colorHex;
  ctx.textBaseline = 'top';

  const isRtl = containsArabic(annotation.content) || annotation.align === 'right';
  if ('direction' in ctx) {
    (ctx as CanvasRenderingContext2D & { direction: CanvasDirection }).direction = isRtl
      ? 'rtl'
      : 'ltr';
  }

  const lineHeight = annotation.fontSize * 1.35;
  const lines = wrapParagraphLines(ctx, annotation.content, usableWidth);

  let anchorX = padding;
  if (annotation.align === 'right') {
    ctx.textAlign = 'right';
    anchorX = widthPt - padding;
  } else if (annotation.align === 'center') {
    ctx.textAlign = 'center';
    anchorX = widthPt / 2;
  } else {
    ctx.textAlign = 'left';
    anchorX = padding;
  }

  let currentY = padding;
  for (const line of lines) {
    if (currentY > heightPt) break;
    ctx.fillText(line, anchorX, currentY);
    currentY += lineHeight;
  }

  const pngDataUrl = canvas.toDataURL('image/png');
  canvas.width = 0;
  canvas.height = 0;

  return dataUrlToBytes(pngDataUrl);
}
