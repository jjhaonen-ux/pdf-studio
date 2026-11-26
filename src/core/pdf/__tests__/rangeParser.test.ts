import { describe, expect, it } from 'vitest';
import { parsePageRange } from '../rangeParser';

describe('parsePageRange', () => {
  it('يعيد جميع الصفحات عند ترك الإدخال فارغاً', () => {
    const res = parsePageRange('', 4);
    expect(res.valid).toBe(true);
    expect(res.indices).toEqual([0, 1, 2, 3]);
  });

  it('يحلل النطاقات والصفحات المتفرقة بدون تكرار', () => {
    const res = parsePageRange('1-3, 5, 2', 6);
    expect(res.valid).toBe(true);
    expect(res.indices).toEqual([0, 1, 2, 4]);
  });

  it('يدعم الأرقام العربية والفاصلة العربية', () => {
    const res = parsePageRange('١-٣، ٥', 6);
    expect(res.valid).toBe(true);
    expect(res.indices).toEqual([0, 1, 2, 4]);
  });

  it('يرفض النطاقات خارج حدود الملف', () => {
    const res = parsePageRange('1-10', 5);
    expect(res.valid).toBe(false);
  });

  it('يرفض النطاق المعكوس', () => {
    const res = parsePageRange('4-2', 5);
    expect(res.valid).toBe(false);
  });
});
