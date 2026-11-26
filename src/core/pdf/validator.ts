import { PDFDocument } from 'pdf-lib';
import { PDF_LIMITS } from './limits';
import { PdfProcessingError } from './errors';
import type { PdfValidationResult } from '@/types/pdf';

const HEADER_SCAN_WINDOW_BYTES = 1024;

/**
 * البحث عن التوقيع الثنائي %PDF- ضمن أول 1024 بايت وفق مواصفة PDF 1.7
 */
export function hasValidPdfHeaderBytes(bytes: Uint8Array): boolean {
  const sample = bytes.subarray(0, Math.min(bytes.byteLength, HEADER_SCAN_WINDOW_BYTES));
  const text = new TextDecoder('latin1').decode(sample);
  return text.includes(PDF_LIMITS.PDF_MAGIC_HEADER);
}

/**
 * فحص سريع لبايتات PDF بحثاً عن مؤشرات التشفير أو التلف قبل التمرير إلى pdf-lib
 */
export function inspectPdfBytes(
  bytes: Uint8Array,
  fileName = 'document.pdf'
): { valid: boolean; code?: 'EMPTY_FILE' | 'INVALID_HEADER' | 'ENCRYPTED_PDF'; error?: string } {
  if (bytes.byteLength === 0) {
    return {
      valid: false,
      code: 'EMPTY_FILE',
      error: `الملف "${fileName}" فارغ.`,
    };
  }

  if (!hasValidPdfHeaderBytes(bytes)) {
    return {
      valid: false,
      code: 'INVALID_HEADER',
      error: `صيغة الملف "${fileName}" غير صالحة؛ هذا ليس ملف PDF حقيقياً.`,
    };
  }

  // فحص الجزء الأخير من الملف (trailer) بحثاً عن قاموس التشفير /Encrypt
  const tailStart = Math.max(0, bytes.byteLength - 8192);
  const tailText = new TextDecoder('latin1').decode(bytes.subarray(tailStart));
  if (/\/Encrypt\s+(\d+\s+\d+\s+R|<<)/.test(tailText)) {
    return {
      valid: false,
      code: 'ENCRYPTED_PDF',
      error: `الملف "${fileName}" محمي بكلمة مرور أو مشفّر ولا يمكن معالجته حالياً.`,
    };
  }

  return { valid: true };
}

/**
 * التحقق الأولي من ملف PDF قبل قراءته بالكامل في الذاكرة
 */
export async function validatePdfFile(file: File): Promise<PdfValidationResult> {
  if (file.size === 0) {
    return { valid: false, error: `الملف "${file.name}" فارغ.` };
  }

  if (file.size > PDF_LIMITS.MAX_FILE_SIZE_BYTES) {
    const maxMb = Math.round(PDF_LIMITS.MAX_FILE_SIZE_BYTES / (1024 * 1024));
    return {
      valid: false,
      error: `يتجاوز الملف "${file.name}" الحد المسموح به (${maxMb} ميجابايت).`,
    };
  }

  const headSize = Math.min(file.size, HEADER_SCAN_WINDOW_BYTES);
  const headerBuffer = await file.slice(0, headSize).arrayBuffer();
  const headerBytes = new Uint8Array(headerBuffer);

  if (!hasValidPdfHeaderBytes(headerBytes)) {
    return {
      valid: false,
      error: `صيغة الملف "${file.name}" غير صالحة؛ هذا ليس ملف PDF حقيقياً.`,
    };
  }

  return { valid: true };
}

/**
 * التحقق من سلامة ملف PDF الناتج بعد التصدير وقبل التنزيل (Post-Export Verification):
 * - وجود توقيع %PDF- سليم
 * - قابلية إعادة الفتح بـ pdf-lib دون أخطاء
 * - تطابق عدد الصفحات الناتج مع العدد المتوقع
 */
export async function verifyExportedPdf(
  bytes: Uint8Array,
  expectedPageCount: number
): Promise<{ valid: true; pageCount: number; sizeBytes: number }> {
  if (!bytes || bytes.byteLength < 64 || !hasValidPdfHeaderBytes(bytes)) {
    throw new PdfProcessingError(
      'EXPORT_VERIFICATION_FAILED',
      'فشل التحقق من الملف الناتج؛ البيانات المولّدة غير صالحة.'
    );
  }

  try {
    const verifiedDoc = await PDFDocument.load(bytes, { ignoreEncryption: false });
    const actualPages = verifiedDoc.getPageCount();
    if (actualPages !== expectedPageCount) {
      throw new PdfProcessingError(
        'EXPORT_VERIFICATION_FAILED',
        `عدم تطابق عدد الصفحات بعد التصدير (المتوقع ${expectedPageCount}، الناتج ${actualPages}).`
      );
    }

    return {
      valid: true,
      pageCount: actualPages,
      sizeBytes: bytes.byteLength,
    };
  } catch (err) {
    if (err instanceof PdfProcessingError) {
      throw err;
    }
    throw new PdfProcessingError(
      'EXPORT_VERIFICATION_FAILED',
      'تعذر التحقق من سلامة ملف PDF الناتج قبل التنزيل.'
    );
  }
}
