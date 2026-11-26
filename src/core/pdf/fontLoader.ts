export interface ArabicFontBundle {
  regular: Uint8Array;
  bold: Uint8Array;
}

const FONT_URLS = {
  regular: '/fonts/DejaVuSans.ttf',
  bold: '/fonts/DejaVuSans-Bold.ttf',
} as const;

let cachedBundle: ArabicFontBundle | null = null;
let inflightLoad: Promise<ArabicFontBundle> | null = null;

async function fetchFontBytes(relativeUrl: string): Promise<Uint8Array> {
  // في بيئة المتصفح أو Web Worker
  if (typeof fetch === 'function' && typeof self !== 'undefined') {
    const base =
      typeof self.location !== 'undefined' && self.location.origin !== 'null'
        ? self.location.origin
        : '';
    const fullUrl = base ? `${base}${relativeUrl}` : relativeUrl;
    const response = await fetch(fullUrl);
    if (!response.ok) {
      throw new Error(`تعذر تحميل ملف الخط (${relativeUrl}): HTTP ${response.status}`);
    }
    const buf = await response.arrayBuffer();
    return new Uint8Array(buf);
  }

  // في بيئة اختبارات Node / Vitest
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const filePath = path.join(process.cwd(), 'public', relativeUrl.replace(/^\//, ''));
  const data = await fs.readFile(filePath);
  return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
}

/**
 * تحميل وتخزين الخطوط العربية المتجهة (DejaVuSans + Bold) مرة واحدة فقط في الذاكرة
 */
export async function loadArabicFontBundle(): Promise<ArabicFontBundle> {
  if (cachedBundle) {
    return cachedBundle;
  }

  if (!inflightLoad) {
    inflightLoad = (async () => {
      const [regular, bold] = await Promise.all([
        fetchFontBytes(FONT_URLS.regular),
        fetchFontBytes(FONT_URLS.bold),
      ]);
      cachedBundle = { regular, bold };
      return cachedBundle;
    })().catch((err) => {
      inflightLoad = null;
      throw err;
    });
  }

  return inflightLoad;
}

export function clearFontCache(): void {
  cachedBundle = null;
  inflightLoad = null;
}
