'use client';

import { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  FileText,
  GripVertical,
  X,
} from 'lucide-react';
import { usePdfStore } from '@/store/usePdfStore';
import { formatBytes } from '@/core/pdf/engine';

export function FileListPanel() {
  const {
    fileOrder,
    sourceFiles,
    moveFile,
    removeFile,
    applyFilePageRange,
  } = usePdfStore();

  const [draftRanges, setDraftRanges] = useState<Record<string, string>>({});
  const [rangeErrors, setRangeErrors] = useState<Record<string, string>>({});
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  if (fileOrder.length === 0) return null;

  const handleApplyRange = (fileId: string) => {
    const source = sourceFiles[fileId];
    if (!source) return;
    const value = draftRanges[fileId] ?? source.pageRangeInput;
    const res = applyFilePageRange(fileId, value);
    if (!res.ok) {
      setRangeErrors((prev) => ({ ...prev, [fileId]: res.error ?? 'نطاق غير صالح' }));
    } else {
      setRangeErrors((prev) => {
        const next = { ...prev };
        delete next[fileId];
        return next;
      });
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-slate-900">
            الملفات المرفوعة ({fileOrder.length})
          </h2>
          <p className="text-xs text-slate-500">
            رتّب الملفات أو حدد نطاق صفحات معين من كل ملف مثل 1-5 أو 1,3,7
          </p>
        </div>
      </div>

      <div className="space-y-2.5">
        {fileOrder.map((fileId, index) => {
          const file = sourceFiles[fileId];
          if (!file) return null;

          const inputValue = draftRanges[fileId] ?? file.pageRangeInput;
          const fieldError = rangeErrors[fileId];

          return (
            <div
              key={file.id}
              draggable
              onDragStart={() => setDraggedIndex(index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (draggedIndex !== null && draggedIndex !== index) {
                  moveFile(draggedIndex, index);
                }
                setDraggedIndex(null);
              }}
              onDragEnd={() => setDraggedIndex(null)}
              className={`rounded-xl border p-3 transition ${
                draggedIndex === index
                  ? 'border-blue-400 bg-blue-50/50 opacity-75'
                  : 'border-slate-200 bg-slate-50/60 hover:border-slate-300'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="cursor-grab text-slate-400 hover:text-slate-600"
                    title="اسحب لتغيير ترتيب الملف"
                  >
                    <GripVertical className="h-4 w-4" />
                  </span>
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: file.colorTag }}
                  />
                  <FileText className="h-4 w-4 shrink-0 text-slate-500" />
                  <div className="min-w-0">
                    <p
                      className="truncate text-sm font-semibold text-slate-800"
                      title={file.name}
                    >
                      {file.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {file.pageCount} صفحة • {formatBytes(file.sizeBytes)}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => moveFile(index, index - 1)}
                    disabled={index === 0}
                    title="نقل لأعلى"
                    className="rounded-md p-1 text-slate-500 transition hover:bg-white hover:text-slate-800 disabled:opacity-30"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveFile(index, index + 1)}
                    disabled={index === fileOrder.length - 1}
                    title="نقل لأسفل"
                    className="rounded-md p-1 text-slate-500 transition hover:bg-white hover:text-slate-800 disabled:opacity-30"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeFile(file.id)}
                    title="إزالة الملف"
                    className="rounded-md p-1 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="mt-2.5 flex items-center gap-2">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) =>
                    setDraftRanges((prev) => ({ ...prev, [file.id]: e.target.value }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleApplyRange(file.id);
                    }
                  }}
                  placeholder={`كل الصفحات (1-${file.pageCount})`}
                  aria-label={`نطاق صفحات ${file.name}`}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
                <button
                  type="button"
                  onClick={() => handleApplyRange(file.id)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-slate-900"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>تطبيق</span>
                </button>
              </div>

              {fieldError && (
                <p className="mt-1.5 text-xs font-medium text-red-600">{fieldError}</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
