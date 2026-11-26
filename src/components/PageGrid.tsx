'use client';

import { useState } from 'react';
import { Eye, EyeOff, RotateCw, Undo } from 'lucide-react';
import { usePdfStore } from '@/store/usePdfStore';
import { PageThumbnailCard } from './PageThumbnailCard';

export function PageGrid() {
  const {
    pages,
    annotations,
    sourceFiles,
    showDeleted,
    setShowDeleted,
    rotatePage,
    rotateAllActivePages,
    toggleDeletePage,
    restoreAllDeletedPages,
    reorderActivePages,
    openPageInEditor,
  } = usePdfStore();

  const [draggedVisibleIndex, setDraggedVisibleIndex] = useState<number | null>(null);

  if (pages.length === 0) return null;

  const activePagesCount = pages.filter((p) => !p.deleted).length;
  const deletedPagesCount = pages.length - activePagesCount;
  const visiblePages = showDeleted ? pages : pages.filter((p) => !p.deleted);

  const countByPage = new Map<string, number>();
  for (const ann of annotations) {
    countByPage.set(ann.pageId, (countByPage.get(ann.pageId) ?? 0) + 1);
  }

  let runningActiveNumber = 0;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div>
          <h2 className="text-sm font-bold text-slate-900">
            صفحات المستند الناتج ({activePagesCount} نشطة
            {deletedPagesCount > 0 ? ` • ${deletedPagesCount} محذوفة` : ''})
          </h2>
          <p className="text-xs text-slate-500">
            اسحب الصفحات لإعادة ترتيبها، أو انقر «تعديل» لإضافة نصوص وصور وتوقيع
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => rotateAllActivePages(90)}
            disabled={activePagesCount === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-40"
          >
            <RotateCw className="h-3.5 w-3.5" />
            <span>تدوير الكل 90°</span>
          </button>

          {deletedPagesCount > 0 && (
            <>
              <button
                type="button"
                onClick={() => setShowDeleted(!showDeleted)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
              >
                {showDeleted ? (
                  <EyeOff className="h-3.5 w-3.5" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
                <span>{showDeleted ? 'إخفاء المحذوفة' : 'عرض المحذوفة'}</span>
              </button>

              <button
                type="button"
                onClick={restoreAllDeletedPages}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100"
              >
                <Undo className="h-3.5 w-3.5" />
                <span>استعادة المحذوفة</span>
              </button>
            </>
          )}
        </div>
      </div>

      {visiblePages.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-sm font-medium text-slate-700">
            تم حذف جميع الصفحات حالياً.
          </p>
          <button
            type="button"
            onClick={restoreAllDeletedPages}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
          >
            <Undo className="h-3.5 w-3.5" />
            <span>استعادة جميع الصفحات</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
          {visiblePages.map((page, visibleIndex) => {
            const sourceFile = sourceFiles[page.sourceFileId];
            if (!sourceFile) return null;

            const displayOrder = page.deleted ? null : ++runningActiveNumber;

            return (
              <PageThumbnailCard
                key={page.id}
                page={page}
                sourceFile={sourceFile}
                displayOrder={displayOrder}
                annotationCount={countByPage.get(page.id) ?? 0}
                visibleIndex={visibleIndex}
                totalVisible={visiblePages.length}
                isDragged={draggedVisibleIndex === visibleIndex}
                onDragStart={() => setDraggedVisibleIndex(visibleIndex)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (
                    draggedVisibleIndex !== null &&
                    draggedVisibleIndex !== visibleIndex
                  ) {
                    reorderActivePages(draggedVisibleIndex, visibleIndex);
                  }
                  setDraggedVisibleIndex(null);
                }}
                onDragEnd={() => setDraggedVisibleIndex(null)}
                onRotate={(delta) => rotatePage(page.id, delta)}
                onToggleDelete={() => toggleDeletePage(page.id)}
                onMove={(targetIdx) => reorderActivePages(visibleIndex, targetIdx)}
                onEdit={() => openPageInEditor(page.id)}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
