'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  PenTool,
  RotateCcw,
  RotateCw,
  Trash2,
  Undo,
} from 'lucide-react';
import type { ProjectPage, SourcePdfFile } from '@/types/pdf';
import { renderPageThumbnail } from '@/core/pdf/thumbnails';
import { usePdfStore } from '@/store/usePdfStore';

interface PageThumbnailCardProps {
  page: ProjectPage;
  sourceFile: SourcePdfFile;
  displayOrder: number | null;
  annotationCount: number;
  visibleIndex: number;
  totalVisible: number;
  isDragged: boolean;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  onDragEnd: () => void;
  onRotate: (delta: 90 | -90) => void;
  onToggleDelete: () => void;
  onMove: (targetIndex: number) => void;
  onEdit: () => void;
}

export function PageThumbnailCard({
  page,
  sourceFile,
  displayOrder,
  annotationCount,
  visibleIndex,
  totalVisible,
  isDragged,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onRotate,
  onToggleDelete,
  onMove,
  onEdit,
}: PageThumbnailCardProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [renderError, setRenderError] = useState(false);
  const [isVisibleInViewport, setIsVisibleInViewport] = useState(false);
  const cacheVersion = usePdfStore((s) => s.cacheVersion);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setIsVisibleInViewport(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisibleInViewport) return;

    let cancelled = false;
    setRenderError(false);

    renderPageThumbnail(sourceFile, page.sourcePageIndex, 280)
      .then((url) => {
        if (!cancelled) setThumbnailUrl(url);
      })
      .catch(() => {
        if (!cancelled) setRenderError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [isVisibleInViewport, sourceFile, page.sourcePageIndex, cacheVersion]);

  return (
    <div
      ref={cardRef}
      draggable={!page.deleted}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`group relative flex flex-col rounded-2xl border bg-white p-2.5 shadow-sm transition-all ${
        page.deleted
          ? 'border-red-200 bg-red-50/40 opacity-65'
          : isDragged
            ? 'scale-[0.98] border-blue-500 ring-2 ring-blue-500/20'
            : 'border-slate-200 hover:border-blue-300 hover:shadow-md'
      }`}
    >
      {/* الشريط العلوي للبطاقة */}
      <div className="mb-2 flex items-center justify-between gap-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: sourceFile.colorTag }}
            title={sourceFile.name}
          />
          <span
            className="truncate text-[11px] font-medium text-slate-500"
            title={sourceFile.name}
          >
            {sourceFile.name}
          </span>
        </div>

        <span
          className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-bold ${
            page.deleted
              ? 'bg-red-100 text-red-700'
              : 'bg-slate-100 text-slate-700'
          }`}
        >
          {page.deleted ? 'محذوفة' : `#${displayOrder}`}
        </span>
      </div>

      {/* منطقة معاينة المصغرة */}
      <div className="relative flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-xl border border-slate-100 bg-slate-100/80">
        {thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnailUrl}
            alt={`صفحة ${page.sourcePageIndex + 1} من ${sourceFile.name}`}
            style={{ transform: `rotate(${page.rotation}deg)` }}
            className="max-h-full max-w-full select-none object-contain transition-transform duration-200"
            draggable={false}
          />
        ) : renderError ? (
          <div className="px-3 text-center text-xs text-slate-500">
            تعذر عرض المعاينة
          </div>
        ) : (
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        )}

        {annotationCount > 0 && !page.deleted && (
          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white shadow">
            <PenTool className="h-2.5 w-2.5" />
            {annotationCount}
          </span>
        )}

        {page.rotation !== 0 && !page.deleted && (
          <span className="absolute bottom-2 left-2 rounded bg-slate-900/75 px-1.5 py-0.5 text-[10px] font-medium text-white">
            {page.rotation}°
          </span>
        )}

        {!page.deleted && (
          <button
            type="button"
            onClick={onEdit}
            className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-lg bg-blue-600/95 px-2 py-1 text-[11px] font-semibold text-white opacity-100 shadow-sm transition hover:bg-blue-700 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
          >
            <PenTool className="h-3 w-3" />
            <span>تعديل</span>
          </button>
        )}
      </div>

      {/* معلومات الصفحة الأصلية وأدوات التحكم */}
      <div className="mt-2.5 flex items-center justify-between gap-1">
        <span className="text-[11px] text-slate-500">
          الأصل: ص {page.sourcePageIndex + 1}
        </span>

        <div className="flex items-center gap-0.5">
          {!page.deleted && (
            <>
              <button
                type="button"
                onClick={onEdit}
                title="تعديل الصفحة (نص / صورة / توقيع)"
                className="rounded-md p-1 text-blue-600 transition hover:bg-blue-50"
              >
                <PenTool className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onMove(visibleIndex - 1)}
                disabled={visibleIndex === 0}
                title="تقديم الصفحة"
                className="rounded-md p-1 text-slate-600 transition hover:bg-slate-100 disabled:opacity-30"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onMove(visibleIndex + 1)}
                disabled={visibleIndex === totalVisible - 1}
                title="تأخير الصفحة"
                className="rounded-md p-1 text-slate-600 transition hover:bg-slate-100 disabled:opacity-30"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onRotate(-90)}
                title="تدوير يساراً 90°"
                className="rounded-md p-1 text-slate-600 transition hover:bg-slate-100"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onRotate(90)}
                title="تدوير يميناً 90°"
                className="rounded-md p-1 text-slate-600 transition hover:bg-slate-100"
              >
                <RotateCw className="h-3.5 w-3.5" />
              </button>
            </>
          )}

          <button
            type="button"
            onClick={onToggleDelete}
            title={page.deleted ? 'استعادة الصفحة' : 'حذف الصفحة'}
            className={`rounded-md p-1 transition ${
              page.deleted
                ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                : 'text-slate-500 hover:bg-red-50 hover:text-red-600'
            }`}
          >
            {page.deleted ? (
              <Undo className="h-3.5 w-3.5" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
