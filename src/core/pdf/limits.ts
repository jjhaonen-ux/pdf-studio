export const PDF_LIMITS = {
  MAX_FILE_SIZE_BYTES: 100 * 1024 * 1024, // 100 ميجابايت لكل ملف PDF
  MAX_TOTAL_MEMORY_BYTES: 250 * 1024 * 1024, // 250 ميجابايت إجمالي لملفات المشروع
  MEMORY_WARNING_RATIO: 0.65, // تنبيه عند استهلاك 65% من الذاكرة المخصصة
  MAX_IMAGE_SIZE_BYTES: 10 * 1024 * 1024, // 10 ميجابايت للصورة الواحدة
  MAX_TOTAL_PAGES: 300, // الحد الأقصى لمجموع الصفحات في المشروع
  PDF_MAGIC_HEADER: '%PDF-',
  MAX_HISTORY_STEPS: 60,
  MAX_THUMBNAIL_CACHE_ENTRIES: 80, // حد ذاكرة الكاش للمصغرات (LRU)
  MAX_CONCURRENT_THUMBNAIL_RENDERS: 3, // أقصى عدد عمليات رسم متزامنة لمنع تجميد المتصفح
  MIN_ZOOM: 0.5,
  MAX_ZOOM: 2.25,
  DEFAULT_ZOOM: 1,
} as const;

export const FILE_COLOR_TAGS = [
  '#2563eb', // أزرق
  '#059669', // زمردي
  '#d97706', // كهرماني
  '#7c3aed', // بنفسجي
  '#e11d48', // وردي داكن
  '#0891b2', // سماوي داكن
  '#4f46e5', // نيلي
  '#ca8a04', // ذهبي
] as const;

export const TEXT_COLOR_PRESETS = [
  '#0f172a',
  '#1d4ed8',
  '#dc2626',
  '#047857',
  '#7c3aed',
  '#b45309',
] as const;
