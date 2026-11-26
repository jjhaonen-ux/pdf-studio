'use client';

import { useState } from 'react';
import {
  Download,
  FileText,
  HelpCircle,
  LayoutGrid,
  Loader2,
  PenTool,
  Redo2,
  ShieldCheck,
  Trash2,
  Undo2,
} from 'lucide-react';
import { usePdfStore } from '@/store/usePdfStore';
import { InfoModal } from './InfoModal';

export function Header() {
  const [infoOpen, setInfoOpen] = useState(false);

  const {
    pages,
    annotations,
    mode,
    setMode,
    outputFilename,
    setOutputFilename,
    exportProject,
    isExporting,
    past,
    future,
    undo,
    redo,
    resetProject,
  } = usePdfStore();

  const activeCount = pages.filter((p) => !p.deleted).length;

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-3 py-2.5 sm:px-6 sm:py-3">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm sm:h-10 sm:w-10">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold text-slate-900 sm:text-lg">
                  محرر PDF المحلي
                </h1>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                  v1.0 MVP
                </span>
              </div>
              <p className="flex items-center gap-1 text-[11px] text-emerald-700 sm:text-xs">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                <span>معالجة محلية داخل المتصفح دون رفع ملفاتك لخادم</span>
              </p>
            </div>
          </div>

          {/* تبديل الوضع بين الدمج والمحرر */}
          {activeCount > 0 && (
            <nav
              aria-label="أوضاع العمل"
              className="flex items-center rounded-xl border border-slate-200 bg-slate-100 p-1"
            >
              <button
                type="button"
                onClick={() => setMode('organize')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition sm:px-3 ${
                  mode === 'organize'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span>الدمج والصفحات</span>
              </button>
              <button
                type="button"
                onClick={() => setMode('editor')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition sm:px-3 ${
                  mode === 'editor'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <PenTool className="h-3.5 w-3.5" />
                <span>محرر الصفحة</span>
                {annotations.length > 0 && (
                  <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
                    {annotations.length}
                  </span>
                )}
              </button>
            </nav>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setInfoOpen(true)}
              title="الخصوصية وفحص التوافق والمساعدة"
              aria-label="الخصوصية وفحص التوافق والمساعدة"
              className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-50 hover:text-blue-600"
            >
              <HelpCircle className="h-4 w-4" />
            </button>

            <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5">
              <button
                type="button"
                onClick={undo}
                disabled={past.length === 0}
                title="تراجع (Ctrl+Z)"
                aria-label="تراجع"
                className="rounded-md p-2 text-slate-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Undo2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={redo}
                disabled={future.length === 0}
                title="إعادة التنفيذ (Ctrl+Y)"
                aria-label="إعادة التنفيذ"
                className="rounded-md p-2 text-slate-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Redo2 className="h-4 w-4" />
              </button>
            </div>

            {pages.length > 0 && (
              <button
                type="button"
                onClick={resetProject}
                title="بدء مشروع جديد"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
                <span className="hidden md:inline">مسح الكل</span>
              </button>
            )}

            <div className="flex items-center gap-1.5 sm:gap-2">
              <input
                type="text"
                value={outputFilename}
                onChange={(e) => setOutputFilename(e.target.value)}
                placeholder="اسم الملف الناتج"
                aria-label="اسم الملف الناتج"
                dir="ltr"
                className="w-32 rounded-lg border border-slate-300 bg-white px-2 py-2 text-left text-xs text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 sm:w-44 sm:px-2.5 sm:text-sm"
              />
              <button
                type="button"
                onClick={exportProject}
                disabled={activeCount === 0 || isExporting}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 sm:gap-2 sm:px-3.5 sm:text-sm"
              >
                {isExporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                <span>
                  {isExporting ? 'جارٍ التصدير...' : `تصدير (${activeCount})`}
                </span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <InfoModal open={infoOpen} onClose={() => setInfoOpen(false)} />
    </>
  );
}
