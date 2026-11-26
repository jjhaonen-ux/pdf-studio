'use client';

import { useEffect } from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import { Header } from '@/components/Header';
import { Dropzone } from '@/components/Dropzone';
import { FileListPanel } from '@/components/FileListPanel';
import { PageGrid } from '@/components/PageGrid';
import { PageEditorView } from '@/components/editor/PageEditorView';
import { PerformanceBar } from '@/components/PerformanceBar';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { usePdfStore } from '@/store/usePdfStore';

function StudioWorkspace() {
  const {
    fileOrder,
    annotations,
    mode,
    error,
    errorDetails,
    statusMessage,
    clearMessages,
    undo,
    redo,
  } = usePdfStore();
  const hasFiles = fileOrder.length > 0;

  // تنبيه المستخدم قبل إغلاق الصفحة في حال وجود عمل غير محفوظ
  useEffect(() => {
    if (!hasFiles && annotations.length === 0) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasFiles, annotations.length]);

  // اختصارات التراجع وإعادة التنفيذ العامة
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable;
      if (isTyping) return;

      const isMod = e.ctrlKey || e.metaKey;
      if (!isMod) return;

      if (e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (
        (e.key.toLowerCase() === 'z' && e.shiftKey) ||
        e.key.toLowerCase() === 'y'
      ) {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undo, redo]);

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />

      <main className="mx-auto max-w-7xl space-y-4 px-3 py-4 sm:px-6 sm:py-5">
        {error && (
          <div
            role="alert"
            className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              <div className="space-y-1">
                <p className="font-semibold">{error}</p>
                {errorDetails.length > 0 && (
                  <ul className="list-disc space-y-0.5 pr-4 text-xs text-red-700">
                    {errorDetails.map((detail, idx) => (
                      <li key={idx}>{detail}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={clearMessages}
              aria-label="إغلاق التنبيه"
              className="rounded p-0.5 text-red-500 hover:bg-red-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {statusMessage && !error && (
          <div
            role="status"
            className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>{statusMessage}</span>
            </div>
            <button
              type="button"
              onClick={clearMessages}
              aria-label="إغلاق الرسالة"
              className="rounded p-0.5 text-emerald-600 hover:bg-emerald-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {!hasFiles ? (
          <div className="mx-auto max-w-2xl pt-6 sm:pt-8">
            <Dropzone />
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-bold text-slate-800">1. رفع ودمج</p>
                <p className="mt-1 text-xs text-slate-500">
                  اسحب عدة ملفات PDF معاً وحدد نطاق صفحات مخصص ورتّبها بحرية.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-bold text-slate-800">2. عربي متجه ومحرر</p>
                <p className="mt-1 text-xs text-slate-500">
                  تضمين خط عربي TTF متجه مع دعم التشكيل وBiDi والصور والتوقيع.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-bold text-slate-800">3. تحقق وأداء محلي</p>
                <p className="mt-1 text-xs text-slate-500">
                  تصدير عبر Web Worker وتحقق تلقائي من سلامة الناتج قبل التنزيل.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <>
            <PerformanceBar />
            {mode === 'editor' ? (
              <PageEditorView />
            ) : (
              <div className="grid gap-6 lg:grid-cols-12">
                <aside className="space-y-4 lg:col-span-4 xl:col-span-3">
                  <Dropzone compact />
                  <FileListPanel />
                </aside>
                <div className="lg:col-span-8 xl:col-span-9">
                  <PageGrid />
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default function HomePage() {
  return (
    <ErrorBoundary>
      <StudioWorkspace />
    </ErrorBoundary>
  );
}
