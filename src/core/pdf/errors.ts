export type PdfErrorCode =
  | 'EMPTY_FILE'
  | 'FILE_TOO_LARGE'
  | 'INVALID_HEADER'
  | 'ENCRYPTED_PDF'
  | 'CORRUPTED_PDF'
  | 'ZERO_PAGES'
  | 'MEMORY_LIMIT'
  | 'PAGE_LIMIT'
  | 'NO_ACTIVE_PAGES'
  | 'EXPORT_VERIFICATION_FAILED'
  | 'EXPORT_CANCELLED'
  | 'UNKNOWN';

export class PdfProcessingError extends Error {
  readonly code: PdfErrorCode;
  readonly suggestion?: string;
  readonly fileName?: string;

  constructor(
    code: PdfErrorCode,
    message: string,
    options?: { suggestion?: string; fileName?: string }
  ) {
    super(message);
    this.name = 'PdfProcessingError';
    this.code = code;
    this.suggestion = options?.suggestion;
    this.fileName = options?.fileName;
  }
}

/**
 * تحويل أخطاء pdf-lib والمتصفح إلى رسائل عربية واضحة ومفيدة للمستخدم
 */
export function classifyPdfError(err: unknown, fileName?: string): PdfProcessingError {
  if (err instanceof PdfProcessingError) {
    return err;
  }

  const raw = err instanceof Error ? err.message : String(err ?? '');
  const lower = raw.toLowerCase();
  const label = fileName ? `"${fileName}"` : 'الملف';

  if (lower.includes('encrypted') || lower.includes('password')) {
    return new PdfProcessingError(
      'ENCRYPTED_PDF',
      `الملف ${label} محمي بكلمة مرور أو مشفّر ولا يمكن معالجته حالياً.`,
      {
        fileName,
        suggestion: 'أزل كلمة المرور من الملف أولاً ثم أعد رفعه.',
      }
    );
  }

  if (
    lower.includes('failed to parse') ||
    lower.includes('no pdf header') ||
    lower.includes('invalid pdf') ||
    lower.includes('xref') ||
    lower.includes('expected') ||
    lower.includes('trailer')
  ) {
    return new PdfProcessingError(
      'CORRUPTED_PDF',
      `تعذر قراءة ${label}؛ يبدو أن بنية ملف PDF تالفة أو غير مكتملة.`,
      {
        fileName,
        suggestion: 'جرّب إعادة حفظ الملف من قارئ PDF (طباعة إلى PDF) ثم أعد المحاولة.',
      }
    );
  }

  return new PdfProcessingError(
    'UNKNOWN',
    raw || `حدث خطأ غير متوقع أثناء معالجة ${label}.`,
    { fileName }
  );
}
