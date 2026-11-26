'use client';

import { useEffect, useState } from 'react';
import {
  Cpu,
  HardDrive,
  Sparkles,
  Trash,
  XCircle,
} from 'lucide-react';
import { usePdfStore } from '@/store/usePdfStore';
import { estimateProjectMemory, type MemoryUsageSnapshot } from '@/core/pdf/memoryManager';
import { formatBytes } from '@/core/pdf/engine';
import { isWebWorkerSupported } from '@/core/pdf/workerClient';

export function PerformanceBar() {
  const {
    sourceFiles,
    annotations,
    textExportMode,
    setTextExportMode,
    freeThumbnailMemory,
    isExporting,
    exportProgress,
    cancelExport,
    cacheVersion,
  } = usePdfStore();

  const [memory, setMemory] = useState<MemoryUsageSnapshot | null>(null);
  const [workerReady, setWorkerReady] = useState(true);

  useEffect(() => {
    setWorkerReady(isWebWorkerSupported());
  }, []);

  useEffect(() => {
    const update = () => {
      setMemory(estimateProjectMemory(sourceFiles, annotations));
    };
    update();
    const timer = setInterval(update, 2500);
    return () => clearInterval(timer);
  }, [sourceFiles, annotations, cacheVersion]);

  const barColor =
    memory?.level === 'high'
      ? 'bg-red-500'
      : memory?.level === 'warning'
        ? 'bg-amber-500'
        : 'bg-emerald-500';

  return (
    <div className="space-y-2.5">
      {/* شريط التقدم المباشر أثناء التصدير عبر Web Worker */}
      {isExporting && exportProgress && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50/90 px-4 py-3 shadow-sm">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold text-blue-900">
              <Cpu className="h-4 w-4 animate-pulse text-blue-600" />
              <span>{exportProgress.stage}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-blue-700">
                {exportProgress.percent}%
              </span>
              <button
                type="button"
                onClick={cancelExport}
                className="inline-flex items-center gap-1 rounded-md border border-blue-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-red-600 transition hover:bg-red-50"
              >
                <XCircle className="h-3.5 w-3.5" />
                <span>إلغاء</span>
              </button>
            </div>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-blue-200/70">
            <div
              className="h-full rounded-full bg-blue-600 transition-all duration-200"
              style={{ width: `${exportProgress.percent}%` }}
            />
          </div>
        </div>
      )}

      {/* شريط معلومات الأداء والذاكرة ووضع الخط العربي */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs text-slate-600 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <Cpu className={`h-3.5 w-3.5 ${workerReady ? 'text-emerald-600' : 'text-amber-500'}`} />
            <span>
              المعالجة:{' '}
              <strong className="text-slate-800">
                {workerReady ? 'Web Worker (خلفية)' : 'الخيط الرئيسي'}
              </strong>
            </span>
          </div>

          {memory && (
            <div className="flex items-center gap-2">
              <HardDrive className="h-3.5 w-3.5 text-slate-500" />
              <span>
                الذاكرة:{' '}
                <strong className="text-slate-800">
                  {formatBytes(memory.totalBytes)}
                </strong>{' '}
                / {formatBytes(memory.limitBytes)}
              </span>
              <div className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-slate-200 sm:block">
                <div
                  className={`h-full rounded-full transition-all ${barColor}`}
                  style={{ width: `${Math.max(4, Math.round(memory.usageRatio * 100))}%` }}
                />
              </div>
              <span className="text-[11px] text-slate-400">
                ({memory.cachedThumbnails}/{memory.maxCachedThumbnails} مصغّرة)
              </span>
              {memory.cachedThumbnails > 0 && (
                <button
                  type="button"
                  onClick={freeThumbnailMemory}
                  title="تفريغ كاش المصغرات لتقليل استهلاك الذاكرة"
                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                >
                  <Trash className="h-3 w-3" />
                  <span>تحرير الكاش</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* اختيار وضع تصدير النص العربي */}
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-blue-600" />
          <span className="text-slate-500">تصدير النص:</span>
          <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            <button
              type="button"
              onClick={() => setTextExportMode('vector')}
              title="تضمين خط عربي TTF متجه قابل للتحديد والبحث في قارئات PDF"
              className={`rounded-md px-2 py-0.5 text-[11px] font-semibold transition ${
                textExportMode === 'vector'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              خط عربي متجه (TTF)
            </button>
            <button
              type="button"
              onClick={() => setTextExportMode('raster')}
              title="تحويل النص إلى صورة عالية الدقة عند التصدير"
              className={`rounded-md px-2 py-0.5 text-[11px] font-semibold transition ${
                textExportMode === 'raster'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              صورة عالية الدقة
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
