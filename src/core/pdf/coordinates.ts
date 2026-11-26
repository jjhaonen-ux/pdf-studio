import type { RotationAngle } from '@/types/pdf';

export interface NormalizedBox {
  xRatio: number;
  yRatio: number;
  widthRatio: number;
  heightRatio: number;
}

export interface PdfMediaBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PdfDrawPlacement {
  /** إحداثي X في نظام MediaBox غير المدوّر */
  x: number;
  /** إحداثي Y في نظام MediaBox غير المدوّر */
  y: number;
  /** العرض بنقاط PDF */
  width: number;
  /** الارتفاع بنقاط PDF */
  height: number;
  /** زاوية التدوير بالدرجات (عكس عقارب الساعة في pdf-lib) ليظهر العنصر مستقيماً */
  rotateDegrees: RotationAngle;
}

export function normalizeRotation(angle: number): RotationAngle {
  const mod = ((Math.round(angle) % 360) + 360) % 360;
  if (mod === 90 || mod === 180 || mod === 270) return mod;
  return 0;
}

/**
 * حساب الأبعاد المرئية لصفحة PDF بعد تطبيق زاوية التدوير الكلية
 */
export function getVisualPageDimensions(
  mediaWidth: number,
  mediaHeight: number,
  totalRotation: number
): { visualWidth: number; visualHeight: number } {
  const rot = normalizeRotation(totalRotation);
  if (rot === 90 || rot === 270) {
    return { visualWidth: mediaHeight, visualHeight: mediaWidth };
  }
  return { visualWidth: mediaWidth, visualHeight: mediaHeight };
}

/**
 * التحويل الدقيق من إحداثيات شاشة المعاينة (الأصل: أعلى اليسار، نسب 0..1)
 * إلى إحداثيات صفحة PDF (الأصل: أسفل اليسار في MediaBox) مع دعم جميع زوايا التدوير.
 */
export function visualBoxToPdfPlacement(
  box: NormalizedBox,
  mediaBox: PdfMediaBox,
  totalRotation: number
): PdfDrawPlacement {
  const rot = normalizeRotation(totalRotation);
  const { visualWidth, visualHeight } = getVisualPageDimensions(
    mediaBox.width,
    mediaBox.height,
    rot
  );

  const vx = box.xRatio * visualWidth;
  const vy = box.yRatio * visualHeight;
  const vw = box.widthRatio * visualWidth;
  const vh = box.heightRatio * visualHeight;

  switch (rot) {
    case 0:
      return {
        x: mediaBox.x + vx,
        y: mediaBox.y + (mediaBox.height - vy - vh),
        width: vw,
        height: vh,
        rotateDegrees: 0,
      };
    case 90:
      return {
        x: mediaBox.x + (vy + vh),
        y: mediaBox.y + vx,
        width: vw,
        height: vh,
        rotateDegrees: 90,
      };
    case 180:
      return {
        x: mediaBox.x + (mediaBox.width - vx),
        y: mediaBox.y + (vy + vh),
        width: vw,
        height: vh,
        rotateDegrees: 180,
      };
    case 270:
      return {
        x: mediaBox.x + (mediaBox.width - vy - vh),
        y: mediaBox.y + (mediaBox.height - vx),
        width: vw,
        height: vh,
        rotateDegrees: 270,
      };
  }
}

/**
 * تحويل نقطة محلية (localX, localY) داخل مربع العنصر — حيث (0,0) هو الركن السفلي الأيسر
 * المرئي للعنصر — إلى إحداثيات MediaBox الفعلية مع مراعاة زاوية التدوير.
 */
export function localPointToPdfPoint(
  placement: PdfDrawPlacement,
  localX: number,
  localY: number
): { x: number; y: number } {
  switch (placement.rotateDegrees) {
    case 0:
      return { x: placement.x + localX, y: placement.y + localY };
    case 90:
      return { x: placement.x - localY, y: placement.y + localX };
    case 180:
      return { x: placement.x - localX, y: placement.y - localY };
    case 270:
      return { x: placement.x + localY, y: placement.y - localX };
  }
}

/**
 * تقييد العنصر داخل حدود الصفحة المرئية (0..1)
 */
export function clampNormalizedBox(
  box: NormalizedBox,
  minSize = 0.03
): NormalizedBox {
  const widthRatio = Math.max(minSize, Math.min(1, box.widthRatio));
  const heightRatio = Math.max(minSize, Math.min(1, box.heightRatio));
  const xRatio = Math.max(0, Math.min(1 - widthRatio, box.xRatio));
  const yRatio = Math.max(0, Math.min(1 - heightRatio, box.yRatio));
  return { xRatio, yRatio, widthRatio, heightRatio };
}
