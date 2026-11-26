export interface CompatibilityCheckItem {
  id: string;
  label: string;
  supported: boolean;
  note: string;
}

export interface BrowserCompatibilityReport {
  allCriticalSupported: boolean;
  userAgent: string;
  viewport: string;
  checks: CompatibilityCheckItem[];
}

export function checkBrowserCompatibility(): BrowserCompatibilityReport {
  if (typeof window === 'undefined') {
    return {
      allCriticalSupported: true,
      userAgent: 'server',
      viewport: '0x0',
      checks: [],
    };
  }

  const hasFileApi = typeof File !== 'undefined' && typeof FileReader !== 'undefined';
  const hasBlobDownload =
    typeof Blob !== 'undefined' && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function';

  let hasCanvas2d = false;
  try {
    const c = document.createElement('canvas');
    hasCanvas2d = Boolean(c.getContext && c.getContext('2d'));
  } catch {
    hasCanvas2d = false;
  }

  const hasWebWorker = typeof Worker !== 'undefined';
  const hasCryptoUuid =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function';
  const hasPointerEvents = typeof PointerEvent !== 'undefined';

  const checks: CompatibilityCheckItem[] = [
    {
      id: 'file-api',
      label: 'قراءة الملفات محلياً (File API)',
      supported: hasFileApi,
      note: hasFileApi ? 'مدعوم' : 'غير مدعوم — يرجى تحديث المتصفح',
    },
    {
      id: 'canvas-2d',
      label: 'معاينة الصفحات والرسم (Canvas 2D)',
      supported: hasCanvas2d,
      note: hasCanvas2d ? 'مدعوم' : 'غير مدعوم',
    },
    {
      id: 'blob-url',
      label: 'تصدير وتنزيل الملفات (Blob URL)',
      supported: hasBlobDownload,
      note: hasBlobDownload ? 'مدعوم' : 'غير مدعوم',
    },
    {
      id: 'web-worker',
      label: 'المعالجة في الخلفية (Web Workers)',
      supported: hasWebWorker,
      note: hasWebWorker
        ? 'مدعوم (واجهة سلسة للملفات الكبيرة)'
        : 'يعمل عبر الخيط الرئيسي تلقائياً',
    },
    {
      id: 'pointer-events',
      label: 'التحكم باللمس والماوس (Pointer Events)',
      supported: hasPointerEvents,
      note: hasPointerEvents ? 'مدعوم للهاتف والحاسوب' : 'دعم محدود للمس',
    },
    {
      id: 'crypto-uuid',
      label: 'توليد المعرفات الآمنة (Web Crypto)',
      supported: hasCryptoUuid,
      note: hasCryptoUuid ? 'مدعوم' : 'يُفضّل فتح التطبيق عبر HTTPS أو localhost',
    },
  ];

  const allCriticalSupported = hasFileApi && hasCanvas2d && hasBlobDownload;

  return {
    allCriticalSupported,
    userAgent: navigator.userAgent,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    checks,
  };
}
