export type RotationAngle = 0 | 90 | 180 | 270;

export type WorkspaceMode = 'organize' | 'editor';

export type TextAlign = 'right' | 'center' | 'left';

/**
 * وضع تصدير النصوص:
 * - vector: تضمين خط TTF عربي متجه قابل للتحديد والبحث عبر @pdf-lib/fontkit (الافتراضي)
 * - raster: رسم النص كصورة PNG عالية الدقة (مفيد للحالات الخاصة أو الرموز التعبيرية)
 */
export type TextExportMode = 'vector' | 'raster';

export interface ExportProgressEvent {
  percent: number;
  stage: string;
  currentPage?: number;
  totalPages?: number;
}

/** الملف الأصلي المرفوع محلياً في ذاكرة المتصفح دون تعديل */
export interface SourcePdfFile {
  id: string;
  name: string;
  sizeBytes: number;
  pageCount: number;
  bytes: Uint8Array;
  /** نص نطاق الصفحات المحدد مثل "1-5, 8" أو فارغ لكل الصفحات */
  pageRangeInput: string;
  /** لون تمييزي للملف في الواجهة */
  colorTag: string;
}

/** تمثيل مرجعي لكل صفحة ضمن المشروع الحالي */
export interface ProjectPage {
  id: string;
  sourceFileId: string;
  /** رقم الصفحة في الملف الأصلي (يبدأ من 0) */
  sourcePageIndex: number;
  rotation: RotationAngle;
  deleted: boolean;
}

/** الخصائص الهندسية المشتركة لكل عنصر مضاف (كنسب من أبعاد الصفحة المرئية 0..1) */
export interface BaseAnnotation {
  id: string;
  pageId: string;
  /** الإحداثي الأفقي للركن العلوي الأيسر كنسبة من عرض الصفحة المرئية */
  xRatio: number;
  /** الإحداثي العمودي للركن العلوي الأيسر كنسبة من ارتفاع الصفحة المرئية */
  yRatio: number;
  /** العرض كنسبة من عرض الصفحة المرئية */
  widthRatio: number;
  /** الارتفاع كنسبة من ارتفاع الصفحة المرئية */
  heightRatio: number;
  opacity: number;
}

export interface TextAnnotation extends BaseAnnotation {
  type: 'text';
  content: string;
  /** حجم الخط بنقاط PDF (pt) ليظل متناسباً بدقة عند أي تكبير */
  fontSize: number;
  colorHex: string;
  bold: boolean;
  align: TextAlign;
  /** خلفية اختيارية مثل #ffffff للكتابة فوق نص قديم أو transparent */
  backgroundColor: string;
}

export interface ImageAnnotation extends BaseAnnotation {
  type: 'image' | 'signature';
  /** صيغة الصورة المضمّنة في pdf-lib */
  mimeType: 'image/png' | 'image/jpeg';
  /** Data URL للعرض السريع داخل المتصفح */
  dataUrl: string;
  /** النسبة الأصلية للعرض إلى الارتفاع للحفاظ على التناسب أثناء التحجيم */
  aspectRatio: number;
  label?: string;
}

export type PageAnnotation = TextAnnotation | ImageAnnotation;

export interface SavedSignature {
  id: string;
  label: string;
  dataUrl: string;
  aspectRatio: number;
  createdAt: number;
}

export interface PdfValidationResult {
  valid: boolean;
  error?: string;
}

export interface PageRangeParseResult {
  valid: boolean;
  /** فهارس الصفحات الصفرية (0-based) بترتيبها المحدد */
  indices: number[];
  error?: string;
}
