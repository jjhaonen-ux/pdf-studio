'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, PenTool } from 'lucide-react';
import type { RenderTask } from 'pdfjs-dist';
import { usePdfStore } from '@/store/usePdfStore';
import { renderPageToEditorCanvas } from '@/core/pdf/thumbnails';
import { EditorToolbar } from './EditorToolbar';
import { AnnotationItem } from './AnnotationItem';
import { AnnotationInspector } from './AnnotationInspector';
import { SignatureModal } from './SignatureModal';

export function PageEditorView() {
  const {
    pages,
    sourceFiles,
    annotations,
    activeEditorPageId,
    setActiveEditorPageId,
    selectedAnnotationId,
    selectAnnotation,
    commitHistoryCheckpoint,
    updateAnnotation,
    deleteAnnotation,
    duplicateAnnotation,
    addImageAnnotation,
    addSavedSignature,
    zoom,
  } = usePdfStore();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);

  const [isRendering, setIsRendering] = useState(false);
  const [stageDims, setStageDims] = useState({
    displayWidthPx: 0,
    displayHeightPx: 0,
    pdfHeightPt: 792,
  });
  const [signatureModalOpen, setSignatureModalOpen] = useState(false);

  const activePages = pages.filter((p) => !p.deleted);
  const currentIndex = Math.max(
    0,
    activePages.findIndex((p) => p.id === activeEditorPageId)
  );
  const currentPage = activePages[currentIndex] ?? null;
  const sourceFile = currentPage ? sourceFiles[currentPage.sourceFileId] : null;

  // رسم صفحة PDF بدقة عالية عند تغيير الصفحة أو التكبير أو التدوير
  useEffect(() => {
    if (!currentPage || !sourceFile || !canvasRef.current) return;

    let cancelled = false;
    setIsRendering(true);

    if (renderTaskRef.current) {
      try {
        renderTaskRef.current.cancel();
      } catch {
        // تجاهل خطأ الإلغاء
      }
      renderTaskRef.current = null;
    }

    renderPageToEditorCanvas(
      sourceFile,
      currentPage.sourcePageIndex,
      currentPage.rotation,
      zoom,
      canvasRef.current,
      (task) => {
        renderTaskRef.current = task;
      }
    )
      .then((result) => {
        if (!cancelled) {
          setStageDims({
            displayWidthPx: result.displayWidthPx,
            displayHeightPx: result.displayHeightPx,
            pdfHeightPt: result.pdfHeightPt,
          });
          setIsRendering(false);
        }
      })
      .catch((err) => {
        // تجاهل خطأ الإلغاء المتعمد عند التكبير أو التبديل السريع
        if (err?.name === 'RenderingCancelledException') return;
        if (!cancelled) {
          setIsRendering(false);
        }
      });

    return () => {
      cancelled = true;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // تجاهل
        }
      }
    };
  }, [currentPage, sourceFile, zoom]);

  // اختصارات لوحة المفاتيح: حذف العنصر المحدد وتحريكه بالأسهم
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable;
      if (isTyping || !selectedAnnotationId) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteAnnotation(selectedAnnotationId);
        return;
      }

      if (e.key === 'Escape') {
        selectAnnotation(null);
        return;
      }

      const step = e.shiftKey ? 0.02 : 0.005;
      const currentAnn = annotations.find((a) => a.id === selectedAnnotationId);
      if (!currentAnn) return;

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        updateAnnotation(currentAnn.id, { xRatio: currentAnn.xRatio + step }, true);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        updateAnnotation(currentAnn.id, { xRatio: currentAnn.xRatio - step }, true);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        updateAnnotation(currentAnn.id, { yRatio: currentAnn.yRatio + step }, true);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        updateAnnotation(currentAnn.id, { yRatio: currentAnn.yRatio - step }, true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedAnnotationId, annotations, deleteAnnotation, selectAnnotation, updateAnnotation]);

  if (!currentPage || !sourceFile) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">
        لا توجد صفحات نشطة للتحرير.
      </div>
    );
  }

  const pageAnnotations = annotations.filter((a) => a.pageId === currentPage.id);

  return (
    <div className="space-y-4">
      <EditorToolbar
        activePageId={currentPage.id}
        currentIndex={currentIndex}
        totalActivePages={activePages.length}
        onPrevPage={() => {
          if (currentIndex > 0) {
            setActiveEditorPageId(activePages[currentIndex - 1].id);
          }
        }}
        onNextPage={() => {
          if (currentIndex < activePages.length - 1) {
            setActiveEditorPageId(activePages[currentIndex + 1].id);
          }
        }}
        onOpenSignatureModal={() => setSignatureModalOpen(true)}
      />

      {/* شريط اختيار الصفحة السريع على الهواتف والأجهزة اللوحية */}
      {activePages.length > 1 && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm xl:hidden">
          <label
            htmlFor="mobile-page-select"
            className="text-xs font-semibold text-slate-600"
          >
            الانتقال إلى صفحة:
          </label>
          <select
            id="mobile-page-select"
            value={currentPage.id}
            onChange={(e) => setActiveEditorPageId(e.target.value)}
            className="rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500"
          >
            {activePages.map((p, idx) => {
              const annCount = annotations.filter((a) => a.pageId === p.id).length;
              return (
                <option key={p.id} value={p.id}>
                  صفحة {idx + 1}
                  {annCount > 0 ? ` (${annCount} عنصر)` : ''}
                </option>
              );
            })}
          </select>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-12">
        {/* شريط التنقل السريع بين الصفحات */}
        <aside className="hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-sm xl:col-span-2 xl:block">
          <p className="mb-2.5 text-xs font-bold text-slate-700">
            الصفحات ({activePages.length})
          </p>
          <div className="max-h-[70vh] space-y-1.5 overflow-y-auto pl-1">
            {activePages.map((p, idx) => {
              const src = sourceFiles[p.sourceFileId];
              const annCount = annotations.filter((a) => a.pageId === p.id).length;
              const isCurrent = p.id === currentPage.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setActiveEditorPageId(p.id)}
                  className={`flex w-full items-center justify-between gap-2 rounded-xl border px-2.5 py-2 text-right text-xs transition ${
                    isCurrent
                      ? 'border-blue-500 bg-blue-50 font-bold text-blue-800'
                      : 'border-slate-100 bg-slate-50/70 text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: src?.colorTag ?? '#2563eb' }}
                    />
                    <span className="truncate">صفحة {idx + 1}</span>
                  </div>
                  {annCount > 0 && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      <PenTool className="h-2.5 w-2.5" />
                      {annCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </aside>

        {/* منطقة معاينة وتحرير الصفحة */}
        <section className="lg:col-span-8 xl:col-span-7">
          <div
            onPointerDown={() => selectAnnotation(null)}
            className="relative flex min-h-[60vh] items-start justify-center overflow-auto rounded-2xl border border-slate-200 bg-slate-200/70 p-3 shadow-inner sm:min-h-[70vh] sm:p-6"
          >
            <div
              className="relative bg-white shadow-xl"
              style={{
                width:
                  stageDims.displayWidthPx > 0
                    ? `${stageDims.displayWidthPx}px`
                    : 'auto',
                height:
                  stageDims.displayHeightPx > 0
                    ? `${stageDims.displayHeightPx}px`
                    : 'auto',
              }}
            >
              <canvas ref={canvasRef} className="block" />

              {isRendering && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-[1px]">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                </div>
              )}

              {/* طبقة العناصر التفاعلية فوق صفحة PDF */}
              {stageDims.displayWidthPx > 0 && stageDims.displayHeightPx > 0 && (
                <div className="absolute inset-0">
                  {pageAnnotations.map((ann) => (
                    <AnnotationItem
                      key={ann.id}
                      annotation={ann}
                      isSelected={ann.id === selectedAnnotationId}
                      stageWidthPx={stageDims.displayWidthPx}
                      stageHeightPx={stageDims.displayHeightPx}
                      pdfHeightPt={stageDims.pdfHeightPt}
                      onSelect={() => selectAnnotation(ann.id)}
                      onBeginInteraction={commitHistoryCheckpoint}
                      onUpdate={(patch) => updateAnnotation(ann.id, patch, false)}
                      onDelete={() => deleteAnnotation(ann.id)}
                      onDuplicate={() => duplicateAnnotation(ann.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          <p className="mt-2 text-center text-xs text-slate-500">
            تلميح: انقر مرتين على أي نص لتحريره مباشرة، واستخدم المقابض لتغيير الحجم، أو الأسهم لتحريك العنصر المحدد بدقة.
          </p>
        </section>

        {/* لوحة الخصائص والعناصر */}
        <div className="lg:col-span-4 xl:col-span-3">
          <AnnotationInspector pageId={currentPage.id} />
        </div>
      </div>

      <SignatureModal
        open={signatureModalOpen}
        onClose={() => setSignatureModalOpen(false)}
        onSave={({ dataUrl, aspectRatio }) => {
          const saved = addSavedSignature({
            label: `توقيع ${new Date().toLocaleTimeString('ar-EG', {
              hour: '2-digit',
              minute: '2-digit',
            })}`,
            dataUrl,
            aspectRatio,
          });
          addImageAnnotation(currentPage.id, {
            type: 'signature',
            mimeType: 'image/png',
            dataUrl: saved.dataUrl,
            aspectRatio: saved.aspectRatio,
            label: saved.label,
          });
        }}
      />
    </div>
  );
}
