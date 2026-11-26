'use client';

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Copy,
  Image as ImageIcon,
  Layers,
  PenTool,
  Trash2,
  Type,
} from 'lucide-react';
import { usePdfStore } from '@/store/usePdfStore';
import { TEXT_COLOR_PRESETS } from '@/core/pdf/limits';
import type { TextAlign } from '@/types/pdf';

interface AnnotationInspectorProps {
  pageId: string;
}

export function AnnotationInspector({ pageId }: AnnotationInspectorProps) {
  const {
    annotations,
    selectedAnnotationId,
    selectAnnotation,
    updateAnnotation,
    deleteAnnotation,
    duplicateAnnotation,
  } = usePdfStore();

  const pageAnnotations = annotations.filter((a) => a.pageId === pageId);
  const selected = pageAnnotations.find((a) => a.id === selectedAnnotationId) ?? null;

  return (
    <aside className="space-y-4">
      {/* لوحة خصائص العنصر المحدد */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-bold text-slate-900">خصائص العنصر</h3>

        {!selected ? (
          <p className="rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-500">
            اختر عنصراً على الصفحة لتعديل خصائصه، أو أضف نصاً أو صورة أو توقيعاً من شريط الأدوات بالأعلى.
          </p>
        ) : selected.type === 'text' ? (
          <div className="space-y-3.5">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                محتوى النص
              </label>
              <textarea
                rows={3}
                value={selected.content}
                onChange={(e) =>
                  updateAnnotation(selected.id, { content: e.target.value }, false)
                }
                dir="auto"
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700">حجم الخط</label>
                <span className="text-xs font-bold text-blue-700">
                  {selected.fontSize} pt
                </span>
              </div>
              <input
                type="range"
                min={8}
                max={64}
                value={selected.fontSize}
                onChange={(e) =>
                  updateAnnotation(
                    selected.id,
                    { fontSize: Number(e.target.value) },
                    false
                  )
                }
                className="w-full accent-blue-600"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                لون النص
              </label>
              <div className="flex flex-wrap items-center gap-2">
                {TEXT_COLOR_PRESETS.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => updateAnnotation(selected.id, { colorHex: hex }, true)}
                    className={`h-6 w-6 rounded-full border-2 transition ${
                      selected.colorHex.toLowerCase() === hex
                        ? 'scale-110 border-blue-500'
                        : 'border-slate-200'
                    }`}
                    style={{ backgroundColor: hex }}
                  />
                ))}
                <input
                  type="color"
                  value={selected.colorHex}
                  onChange={(e) =>
                    updateAnnotation(selected.id, { colorHex: e.target.value }, false)
                  }
                  aria-label="اختيار لون مخصص"
                  className="h-7 w-7 cursor-pointer rounded border border-slate-300 p-0.5"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                {(
                  [
                    ['right', AlignRight, 'محاذاة لليمين'],
                    ['center', AlignCenter, 'توسيط'],
                    ['left', AlignLeft, 'محاذاة لليسار'],
                  ] as [TextAlign, typeof AlignRight, string][]
                ).map(([alignVal, Icon, title]) => (
                  <button
                    key={alignVal}
                    type="button"
                    title={title}
                    onClick={() => updateAnnotation(selected.id, { align: alignVal }, true)}
                    className={`rounded-md p-1.5 transition ${
                      selected.align === alignVal
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() =>
                  updateAnnotation(selected.id, { bold: !selected.bold }, true)
                }
                title="خط عريض"
                className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
                  selected.bold
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Bold className="h-3.5 w-3.5" />
                <span>عريض</span>
              </button>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                خلفية مربع النص
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    updateAnnotation(selected.id, { backgroundColor: 'transparent' }, true)
                  }
                  className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                    selected.backgroundColor === 'transparent'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  شفافة
                </button>
                <button
                  type="button"
                  onClick={() =>
                    updateAnnotation(selected.id, { backgroundColor: '#ffffff' }, true)
                  }
                  className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                    selected.backgroundColor === '#ffffff'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  بيضاء (تغطية)
                </button>
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700">الشفافية</label>
                <span className="text-xs text-slate-500">
                  {Math.round(selected.opacity * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0.2}
                max={1}
                step={0.05}
                value={selected.opacity}
                onChange={(e) =>
                  updateAnnotation(selected.id, { opacity: Number(e.target.value) }, false)
                }
                className="w-full accent-blue-600"
              />
            </div>

            <div className="flex items-center gap-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => duplicateAnnotation(selected.id)}
                className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <Copy className="h-3.5 w-3.5" />
                <span>تكرار</span>
              </button>
              <button
                type="button"
                onClick={() => deleteAnnotation(selected.id)}
                className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg border border-red-200 bg-red-50 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>حذف</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3.5">
            <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-2.5 text-xs text-slate-700">
              {selected.type === 'signature' ? (
                <PenTool className="h-4 w-4 text-blue-600" />
              ) : (
                <ImageIcon className="h-4 w-4 text-blue-600" />
              )}
              <span className="truncate font-semibold">
                {selected.label ?? (selected.type === 'signature' ? 'توقيع' : 'صورة')}
              </span>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700">الشفافية</label>
                <span className="text-xs text-slate-500">
                  {Math.round(selected.opacity * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0.2}
                max={1}
                step={0.05}
                value={selected.opacity}
                onChange={(e) =>
                  updateAnnotation(selected.id, { opacity: Number(e.target.value) }, false)
                }
                className="w-full accent-blue-600"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-slate-50 p-2">
                <span className="text-slate-400">العرض النسبي</span>
                <p className="font-bold text-slate-700">
                  {Math.round(selected.widthRatio * 100)}%
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 p-2">
                <span className="text-slate-400">الارتفاع النسبي</span>
                <p className="font-bold text-slate-700">
                  {Math.round(selected.heightRatio * 100)}%
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => duplicateAnnotation(selected.id)}
                className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <Copy className="h-3.5 w-3.5" />
                <span>تكرار</span>
              </button>
              <button
                type="button"
                onClick={() => deleteAnnotation(selected.id)}
                className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg border border-red-200 bg-red-50 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>حذف</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* قائمة العناصر المضافة على الصفحة */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-2.5 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
            <Layers className="h-4 w-4 text-slate-500" />
            <span>عناصر الصفحة ({pageAnnotations.length})</span>
          </h3>
        </div>

        {pageAnnotations.length === 0 ? (
          <p className="text-xs text-slate-400">لا توجد عناصر مضافة على هذه الصفحة بعد.</p>
        ) : (
          <ul className="space-y-1.5">
            {pageAnnotations.map((item, idx) => {
              const active = item.id === selectedAnnotationId;
              return (
                <li
                  key={item.id}
                  onClick={() => selectAnnotation(item.id)}
                  className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-xs transition ${
                    active
                      ? 'border-blue-400 bg-blue-50 text-blue-800'
                      : 'border-slate-100 bg-slate-50/70 text-slate-700 hover:border-slate-200'
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    {item.type === 'text' ? (
                      <Type className="h-3.5 w-3.5 shrink-0" />
                    ) : item.type === 'signature' ? (
                      <PenTool className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <ImageIcon className="h-3.5 w-3.5 shrink-0" />
                    )}
                    <span className="truncate font-medium">
                      {item.type === 'text'
                        ? item.content.trim() || `نص #${idx + 1}`
                        : item.label ?? (item.type === 'signature' ? 'توقيع' : 'صورة')}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteAnnotation(item.id);
                    }}
                    title="حذف"
                    className="rounded p-0.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
