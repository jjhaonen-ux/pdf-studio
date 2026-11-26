import { describe, expect, it } from 'vitest';
import { validatePdfFile } from '../validator';

describe('validatePdfFile', () => {
  it('يرفض الملف الفارغ', async () => {
    const empty = new File([], 'empty.pdf', { type: 'application/pdf' });
    const result = await validatePdfFile(empty);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('فارغ');
  });

  it('يرفض ملفاً نصياً تم تغيير امتداده إلى pdf', async () => {
    const fakePdf = new File(['Hello World'], 'fake.pdf', {
      type: 'application/pdf',
    });
    const result = await validatePdfFile(fakePdf);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('ليس ملف PDF');
  });

  it('يقبل ملف PDF يحمل التوقيع الثنائي الصحيح', async () => {
    const validHeader = new File(['%PDF-1.7\n...'], 'real.pdf', {
      type: 'application/pdf',
    });
    const result = await validatePdfFile(validHeader);
    expect(result.valid).toBe(true);
  });
});
