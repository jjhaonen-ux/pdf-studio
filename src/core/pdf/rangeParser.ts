import type { PageRangeParseResult } from '@/types/pdf';

const ARABIC_DIGITS_MAP: Record<string, string> = {
  '٠': '0',
  '١': '1',
  '٢': '2',
  '٣': '3',
  '٤': '4',
  '٥': '5',
  '٦': '6',
  '٧': '7',
  '٨': '8',
  '٩': '9',
};

function normalizeRangeText(input: string): string {
  return input
    .replace(/[٠-٩]/g, (d) => ARABIC_DIGITS_MAP[d] ?? d)
    .replace(/،/g, ',')
    .replace(/[–—]/g, '-')
    .trim();
}

/**
 * تحليل نص نطاق الصفحات مثل: "1-3, 5, 8-10" أو "١-٣، ٥".
 * النص الفارغ يعني اختيار جميع الصفحات.
 */
export function parsePageRange(input: string, maxPages: number): PageRangeParseResult {
  if (maxPages <= 0) {
    return { valid: false, indices: [], error: 'لا يحتوي الملف على صفحات.' };
  }

  const normalized = normalizeRangeText(input);

  if (!normalized) {
    const allIndices = Array.from({ length: maxPages }, (_, idx) => idx);
    return { valid: true, indices: allIndices };
  }

  const parts = normalized
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return { valid: false, indices: [], error: 'يرجى إدخال نطاق صفحات صالح مثل 1-3, 5.' };
  }

  const result: number[] = [];
  const seen = new Set<number>();

  for (const part of parts) {
    if (part.includes('-')) {
      const bounds = part.split('-').map((b) => b.trim());
      if (bounds.length !== 2 || !/^\d+$/.test(bounds[0]) || !/^\d+$/.test(bounds[1])) {
        return {
          valid: false,
          indices: [],
          error: `صيغة النطاق "${part}" غير صحيحة. استخدم صيغة مثل 1-5.`,
        };
      }

      const start = Number(bounds[0]);
      const end = Number(bounds[1]);

      if (start < 1 || end < 1 || start > maxPages || end > maxPages) {
        return {
          valid: false,
          indices: [],
          error: `النطاق "${part}" خارج حدود صفحات الملف (1 إلى ${maxPages}).`,
        };
      }

      if (start > end) {
        return {
          valid: false,
          indices: [],
          error: `في النطاق "${part}" يجب أن تكون البداية أصغر من النهاية أو مساوية لها.`,
        };
      }

      for (let pageNum = start; pageNum <= end; pageNum++) {
        const zeroIndex = pageNum - 1;
        if (!seen.has(zeroIndex)) {
          seen.add(zeroIndex);
          result.push(zeroIndex);
        }
      }
    } else {
      if (!/^\d+$/.test(part)) {
        return {
          valid: false,
          indices: [],
          error: `القيمة "${part}" ليست رقم صفحة صالحاً.`,
        };
      }

      const pageNum = Number(part);
      if (pageNum < 1 || pageNum > maxPages) {
        return {
          valid: false,
          indices: [],
          error: `الصفحة ${pageNum} خارج حدود الملف (1 إلى ${maxPages}).`,
        };
      }

      const zeroIndex = pageNum - 1;
      if (!seen.has(zeroIndex)) {
        seen.add(zeroIndex);
        result.push(zeroIndex);
      }
    }
  }

  if (result.length === 0) {
    return { valid: false, indices: [], error: 'لم يتم تحديد أي صفحة صالحة.' };
  }

  return { valid: true, indices: result };
}
