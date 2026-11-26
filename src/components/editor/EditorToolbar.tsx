'use client';

import { useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  PenTool,
  RotateCw,
  Trash2,
  Type,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { usePdfStore } from '@/store/usePdfStore';
import { loadImageAssetFromFile } from '@/core/pdf/imageUtils';
import { PDF_LIMITS } from '@/core/pdf/limits';

interface EditorToolbarProps {
  activePageId: string;
  currentIndex: number;
  totalActivePages: number;
  onPrevPage: () => void;
  onNextPage: () => void;
  onOpenSignatureModal: () => void;
}

export function EditorToolbar({
  activePageId,
  currentIndex,
  totalActivePages,
  onPrevPage,
  onNextPage,
  onOpenSignatureModal,
}: EditorToolbarProps) {
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const [showSavedSigs, setShowSavedSigs] = useState(false);

  const {
    zoom,
    setZoom,
    rotatePage,
    addTextAnnotation,
    addImageAnnotation,
    savedSignatures,
    removeSavedSignature,
    setError,
  } = usePdfStore();

  const handleImageSelected = async (file: File | undefined) => {
    if (!file) return;
    try {
      setError(null);
      const asset = await loadImageAssetFromFile(file);
      addImageAnnotation(activePageId, {
        type: 'image',
        mimeType: asset.mimeType,
        dataUrl: asset.dataUrl,
        aspectRatio: asset.aspectRatio,
        label: file.name,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إضافة الصورة.');
    } finally {
      if (imageInputRef.current) {
        imageInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
      {/* أدوات الإضافة */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => addTextAnnotation(activePageId)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700"
        >
          <Type className="h-4 w-4" />
          <span>إضافة نص</span>
        </button>

        <input
          ref={imageInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => void handleImageSelected(e.target.files?.[0])}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => imageInputRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
        >
          <ImagePlus className="h-4 w-4 text-blue-600" />
          <span>إضافة صورة</span>
        </button>

        <div className="relative flex items-center">
          <button
            type="button"
            onClick={onOpenSignatureModal}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            <PenTool className="h-4 w-4 text-blue-600" />
            <span>إضافة توقيع</span>
          </button>

          {savedSignatures.length > 0 && (
            <button
              type="button"
              onClick={() => setShowSavedSigs((s) => !s)}
              title="التوقيعات المحفوظة"
              className="mr-1 rounded-lg border border-slate-200 bg-slate-50 p-1.5 text-slate-600 hover:bg-slate-100"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          )}

          {showSavedSigs && savedSignatures.length > 0 && (
            <div className="absolute right-0 top-10 z-40 w-60 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
              <p className="mb-1.5 px-1 text-[11px] font-semibold text-slate-500">
                توقيعاتك المحفوظة في هذه الجلسة
              </p>
              <div className="space-y-1.5">
                {savedSignatures.map((sig) => (
                  <div
                    key={sig.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 p-1.5 hover:border-blue-300"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        addImageAnnotation(activePageId, {
                          type: 'signature',
                          mimeType: 'image/png',
                          dataUrl: sig.dataUrl,
                          aspectRatio: sig.aspectRatio,
                          label: sig.label,
                        });
                        setShowSavedSigs(false);
                      }}
                      className="flex flex-1 items-center justify-center rounded bg-white p-1"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={sig.dataUrl}
                        alt={sig.label}
                        className="h-8 max-w-full object-contain"
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeSavedSignature(sig.id)}
                      className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => rotatePage(activePageId, 90)}
          title="تدوير الصفحة الحالية 90°"
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
        >
          <RotateCw className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">تدوير</span>
        </button>
      </div>

      {/* التكبير والتنقل بين الصفحات */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
          <button
            type="button"
            onClick={() => setZoom(zoom - 0.15)}
            disabled={zoom <= PDF_LIMITS.MIN_ZOOM}
            title="تصغير"
            className="rounded-md p-1.5 text-slate-700 hover:bg-white disabled:opacity-35"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            title="إعادة التكبير إلى 100%"
            className="min-w-[52px] rounded-md px-2 py-1 text-xs font-bold text-slate-700 hover:bg-white"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            onClick={() => setZoom(zoom + 0.15)}
            disabled={zoom >= PDF_LIMITS.MAX_ZOOM}
            title="تكبير"
            className="rounded-md p-1.5 text-slate-700 hover:bg-white disabled:opacity-35"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
          <button
            type="button"
            onClick={onPrevPage}
            disabled={currentIndex <= 0}
            title="الصفحة السابقة"
            className="rounded-md p-1.5 text-slate-700 hover:bg-white disabled:opacity-35"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <span className="px-2 text-xs font-semibold text-slate-700">
            صفحة {currentIndex + 1} / {totalActivePages}
          </span>
          <button
            type="button"
            onClick={onNextPage}
            disabled={currentIndex >= totalActivePages - 1}
            title="الصفحة التالية"
            className="rounded-md p-1.5 text-slate-700 hover:bg-white disabled:opacity-35"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
