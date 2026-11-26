'use client';

import { useRef, useState } from 'react';
import { Loader2, UploadCloud } from 'lucide-react';
import { usePdfStore } from '@/store/usePdfStore';
import { PDF_LIMITS } from '@/core/pdf/limits';

interface DropzoneProps {
  compact?: boolean;
}

export function Dropzone({ compact = false }: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const { addFiles, isLoading } = usePdfStore();

  const maxMb = Math.round(PDF_LIMITS.MAX_FILE_SIZE_BYTES / (1024 * 1024));

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    await addFiles(Array.from(fileList));
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        void handleFiles(e.dataTransfer.files);
      }}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      className={`group cursor-pointer rounded-2xl border-2 border-dashed transition-all ${
        isDragging
          ? 'border-blue-500 bg-blue-50/70'
          : 'border-slate-300 bg-white hover:border-blue-400 hover:bg-slate-50/70'
      } ${compact ? 'p-4' : 'px-6 py-12 text-center'}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        onChange={(e) => void handleFiles(e.target.files)}
        className="hidden"
      />

      <div
        className={`flex items-center justify-center ${
          compact ? 'flex-row gap-3' : 'flex-col gap-3'
        }`}
      >
        <div
          className={`flex items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition group-hover:scale-105 ${
            compact ? 'h-10 w-10 shrink-0' : 'h-14 w-14'
          }`}
        >
          {isLoading ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <UploadCloud className={compact ? 'h-5 w-5' : 'h-7 w-7'} />
          )}
        </div>

        <div className={compact ? 'text-right' : 'text-center'}>
          <p className="text-sm font-semibold text-slate-800">
            {isLoading
              ? 'جارٍ قراءة الملفات والتحقق منها...'
              : compact
                ? 'أضف ملفات PDF أخرى بالسحب أو النقر'
                : 'اسحب ملفات PDF وأفلتها هنا، أو انقر للاختيار'}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            يدعم اختيار عدة ملفات معاً — الحد الأقصى {maxMb} ميجابايت للملف و{PDF_LIMITS.MAX_TOTAL_PAGES} صفحة للمشروع
          </p>
        </div>
      </div>
    </div>
  );
}
