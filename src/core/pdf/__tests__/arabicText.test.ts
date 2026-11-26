import { describe, expect, it } from 'vitest';
import {
  hasArabicCharacters,
  prepareVectorLineForPdf,
  reshapeArabicText,
  toVisualBidiLine,
} from '../arabicText';

describe('arabicText reshaping & BiDi', () => {
  it('يكتشف وجود الحروف العربية بدقة', () => {
    expect(hasArabicCharacters('مرحبا 2026')).toBe(true);
    expect(hasArabicCharacters('Invoice #2026')).toBe(false);
  });

  it('يربط الحروف العربية إلى أشكالها السياقية الصحيحة (ابتدائي/وسطي/نهائي)', () => {
    // كلمة "كتب": ك (ابتدائي 0xFEDB) + ت (وسطي 0xFE98) + ب (نهائي 0xFE90)
    const shaped = reshapeArabicText('كتب');
    expect(Array.from(shaped).map((c) => c.charCodeAt(0))).toEqual([
      0xfedb,
      0xfe98,
      0xfe90,
    ]);
  });

  it('يدمج ربط لام-ألف (لا) في الشكل المنفصل والمتصل', () => {
    // "لا" منفصلة -> 0xFEFB
    expect(reshapeArabicText('لا').charCodeAt(0)).toBe(0xfefb);
    // "بلا": ب (ابتدائي 0xFE91) + لا (نهائي 0xFEFC)
    const bala = reshapeArabicText('بلا');
    expect(Array.from(bala).map((c) => c.charCodeAt(0))).toEqual([0xfe91, 0xfefc]);
  });

  it('يحافظ على اتصال الحروف مع وجود التشكيل (الحركات)', () => {
    // "بَاب": ب (ابتدائي 0xFE91) + فتحة (0x064E) + ا (نهائي 0xFE8E) + ب (منفصل 0xFE8F)
    const shaped = reshapeArabicText('بَاب');
    expect(Array.from(shaped).map((c) => c.charCodeAt(0))).toEqual([
      0xfe91,
      0x064e,
      0xfe8e,
      0xfe8f,
    ]);
  });

  it('يرتّب النصوص المختلطة (عربي + إنجليزي + أرقام) بصرياً دون عكس الإنجليزية', () => {
    const visual = prepareVectorLineForPdf('رقم PDF 2026 مهم', 'rtl');
    expect(visual).toContain('PDF 2026');
    // الكلمة الأخيرة منطقياً "مهم" تظهر أقصى اليسار (بداية السلسلة البصرية)
    expect(visual.startsWith(toVisualBidiLine(reshapeArabicText('مهم'), 'rtl'))).toBe(true);
  });

  it('يعكس الأقواس بشكل صحيح في السياق العربي', () => {
    const visual = prepareVectorLineForPdf('بند (1)', 'rtl');
    expect(visual).toContain('(1)');
  });
});
