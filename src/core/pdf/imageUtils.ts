import { PDF_LIMITS } from './limits';

export interface LoadedImageAsset {
  mimeType: 'image/png' | 'image/jpeg';
  dataUrl: string;
  aspectRatio: number;
  width: number;
  height: number;
}

const SUPPORTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('تعذر قراءة بيانات الصورة.'));
      }
    };
    reader.onerror = () => reject(new Error('تعذر قراءة ملف الصورة.'));
    reader.readAsDataURL(file);
  });
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('تعذر فك ترميز الصورة؛ قد تكون تالفة.'));
    img.src = src;
  });
}

/**
 * التحقق من ملف الصورة وتحميله، مع تحويل WebP تلقائياً إلى PNG لضمان التوافق مع pdf-lib
 */
export async function loadImageAssetFromFile(file: File): Promise<LoadedImageAsset> {
  if (!SUPPORTED_IMAGE_TYPES.includes(file.type)) {
    throw new Error('صيغة الصورة غير مدعومة. يُرجى اختيار صورة PNG أو JPG أو WebP.');
  }

  if (file.size === 0) {
    throw new Error('ملف الصورة فارغ.');
  }

  if (file.size > PDF_LIMITS.MAX_IMAGE_SIZE_BYTES) {
    const maxMb = Math.round(PDF_LIMITS.MAX_IMAGE_SIZE_BYTES / (1024 * 1024));
    throw new Error(`حجم الصورة يتجاوز الحد المسموح به (${maxMb} ميجابايت).`);
  }

  const rawDataUrl = await readFileAsDataUrl(file);
  const img = await loadHtmlImage(rawDataUrl);
  const width = img.naturalWidth || 300;
  const height = img.naturalHeight || 200;
  const aspectRatio = width / Math.max(1, height);

  if (file.type === 'image/png' || file.type === 'image/jpeg') {
    return {
      mimeType: file.type,
      dataUrl: rawDataUrl,
      aspectRatio,
      width,
      height,
    };
  }

  // تحويل WebP إلى PNG عبر Canvas
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('تعذر تحويل الصورة إلى صيغة PNG.');
  }
  ctx.drawImage(img, 0, 0);
  const pngDataUrl = canvas.toDataURL('image/png');
  canvas.width = 0;
  canvas.height = 0;

  return {
    mimeType: 'image/png',
    dataUrl: pngDataUrl,
    aspectRatio,
    width,
    height,
  };
}

/**
 * تحويل Data URL (مثل data:image/png;base64,...) إلى مصفوفة بايتات لتضمينها في pdf-lib
 */
export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx === -1) {
    throw new Error('صيغة بيانات الصورة غير صالحة.');
  }
  const base64 = dataUrl.slice(commaIdx + 1);
  if (typeof atob === 'function') {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  return new Uint8Array(Buffer.from(base64, 'base64'));
}
