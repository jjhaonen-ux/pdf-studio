import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import {
  hasValidPdfHeaderBytes,
  inspectPdfBytes,
  verifyExportedPdf,
} from '../validator';
import { classifyPdfError, PdfProcessingError } from '../errors';
import { loadSourcePdf } from '../engine';

describe('Phase 5 Hardening: Corrupted, Encrypted & Output Verification', () => {
  it('يقبل توقيع %PDF- حتى مع وجود مسافات أو بايتات بادئة ضمن أول 1024 بايت', () => {
    const padded = new TextEncoder().encode('\n   %PDF-1.7\n...');
    expect(hasValidPdfHeaderBytes(padded)).toBe(true);
  });

  it('يرصد ملف PDF يحتوي على قاموس التشفير /Encrypt ويرفضه برسالة واضحة', () => {
    const fakeEncrypted = new TextEncoder().encode(
      '%PDF-1.7\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Size 2 /Encrypt 5 0 R >>\n%%EOF'
    );
    const inspection = inspectPdfBytes(fakeEncrypted, 'secret.pdf');
    expect(inspection.valid).toBe(false);
    expect(inspection.code).toBe('ENCRYPTED_PDF');
    expect(inspection.error).toContain('محمي بكلمة مرور');
  });

  it('يلتقط الملفات التالفة عبر loadSourcePdf ويصنّف الخطأ كـ CORRUPTED_PDF', async () => {
    const corrupted = new File(['%PDF-1.7\nBROKEN_BINARY_DATA_NO_XREF'], 'broken.pdf', {
      type: 'application/pdf',
    });

    await expect(loadSourcePdf(corrupted, '#2563eb')).rejects.toMatchObject({
      name: 'PdfProcessingError',
      code: 'CORRUPTED_PDF',
    });
  });

  it('يرفض ملف PDF صالح البنية لكنه لا يحتوي على أي صفحات (0 pages)', async () => {
    const emptyDoc = await PDFDocument.create();
    const bytes = await emptyDoc.save();
    const zeroPageFile = new File([bytes.buffer as ArrayBuffer], 'zero.pdf', {
      type: 'application/pdf',
    });

    await expect(loadSourcePdf(zeroPageFile, '#2563eb')).rejects.toMatchObject({
      code: 'ZERO_PAGES',
    });
  });

  it('يتحقق من سلامة الملف المصدّر ويرفض الناتج التالف أو غير المتطابق في عدد الصفحات', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([400, 600]);
    doc.addPage([400, 600]);
    const validBytes = await doc.save();

    const verified = await verifyExportedPdf(validBytes, 2);
    expect(verified.valid).toBe(true);
    expect(verified.pageCount).toBe(2);

    await expect(verifyExportedPdf(validBytes, 3)).rejects.toThrow(PdfProcessingError);
    await expect(
      verifyExportedPdf(new TextEncoder().encode('not-a-pdf'), 1)
    ).rejects.toThrow(PdfProcessingError);
  });

  it('يصنّف أخطاء التشفير والتلف برسائل وتوجيهات عربية واضحة', () => {
    const enc = classifyPdfError(new Error('Input document to PDFDocument.load is encrypted'), 'a.pdf');
    expect(enc.code).toBe('ENCRYPTED_PDF');
    expect(enc.suggestion).toBeTruthy();

    const bad = classifyPdfError(new Error('Failed to parse PDF document (no xref)'), 'b.pdf');
    expect(bad.code).toBe('CORRUPTED_PDF');
    expect(bad.suggestion).toBeTruthy();
  });
});
