'use client';

import { useEffect, useRef, useState } from 'react';
import { Copy, Trash2 } from 'lucide-react';
import type { PageAnnotation } from '@/types/pdf';

interface AnnotationItemProps {
  annotation: PageAnnotation;
  isSelected: boolean;
  stageWidthPx: number;
  stageHeightPx: number;
  pdfHeightPt: number;
  onSelect: () => void;
  onBeginInteraction: () => void;
  onUpdate: (patch: Partial<PageAnnotation>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se' | 'e' | 'w';

export function AnnotationItem({
  annotation,
  isSelected,
  stageWidthPx,
  stageHeightPx,
  pdfHeightPt,
  onSelect,
  onBeginInteraction,
  onUpdate,
  onDelete,
  onDuplicate,
}: AnnotationItemProps) {
  const [isEditingText, setIsEditingText] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!isSelected) {
      setIsEditingText(false);
    }
  }, [isSelected]);

  useEffect(() => {
    if (isEditingText && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditingText]);

  const leftPx = annotation.xRatio * stageWidthPx;
  const topPx = annotation.yRatio * stageHeightPx;
  const widthPx = annotation.widthRatio * stageWidthPx;
  const heightPx = annotation.heightRatio * stageHeightPx;

  // تحويل حجم الخط من نقاط PDF إلى بكسل متناسب مع مستوى التكبير الحالي
  const pxPerPt = pdfHeightPt > 0 ? stageHeightPx / pdfHeightPt : 1;

  const startDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isEditingText) return;
    e.stopPropagation();
    onSelect();

    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const initX = annotation.xRatio;
    const initY = annotation.yRatio;
    let moved = false;

    const handleMove = (moveEvent: PointerEvent) => {
      const dxPx = moveEvent.clientX - startClientX;
      const dyPx = moveEvent.clientY - startClientY;
      if (!moved && Math.abs(dxPx) + Math.abs(dyPx) < 3) return;

      if (!moved) {
        moved = true;
        onBeginInteraction();
      }

      onUpdate({
        xRatio: initX + dxPx / Math.max(1, stageWidthPx),
        yRatio: initY + dyPx / Math.max(1, stageHeightPx),
      });
    };

    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  };

  const startResize = (
    e: React.PointerEvent<HTMLDivElement>,
    handle: ResizeHandle
  ) => {
    e.stopPropagation();
    e.preventDefault();
    onSelect();
    onBeginInteraction();

    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const initX = annotation.xRatio;
    const initY = annotation.yRatio;
    const initW = annotation.widthRatio;
    const initH = annotation.heightRatio;
    const pageAspect = stageWidthPx / Math.max(1, stageHeightPx);

    const handleMove = (moveEvent: PointerEvent) => {
      const dx = (moveEvent.clientX - startClientX) / Math.max(1, stageWidthPx);
      const dy = (moveEvent.clientY - startClientY) / Math.max(1, stageHeightPx);

      let nextX = initX;
      let nextY = initY;
      let nextW = initW;
      let nextH = initH;

      if (handle.includes('e')) {
        nextW = Math.max(0.05, initW + dx);
      }
      if (handle.includes('w')) {
        const clampedDx = Math.min(dx, initW - 0.05);
        nextX = initX + clampedDx;
        nextW = initW - clampedDx;
      }
      if (handle.includes('s')) {
        nextH = Math.max(0.035, initH + dy);
      }
      if (handle.includes('n')) {
        const clampedDy = Math.min(dy, initH - 0.035);
        nextY = initY + clampedDy;
        nextH = initH - clampedDy;
      }

      // الحفاظ على نسبة الأبعاد للصور والتوقيعات عند التحجيم من الزوايا
      if (annotation.type !== 'text' && handle.length === 2) {
        const targetRatio = annotation.aspectRatio;
        nextH = (nextW * pageAspect) / Math.max(0.1, targetRatio);
        if (handle.includes('n')) {
          nextY = initY + (initH - nextH);
        }
      }

      onUpdate({
        xRatio: nextX,
        yRatio: nextY,
        widthRatio: nextW,
        heightRatio: nextH,
      });
    };

    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  };

  return (
    <div
      style={{
        left: `${leftPx}px`,
        top: `${topPx}px`,
        width: `${widthPx}px`,
        height: `${heightPx}px`,
        opacity: annotation.opacity,
      }}
      onPointerDown={startDrag}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (annotation.type === 'text') {
          onBeginInteraction();
          setIsEditingText(true);
        }
      }}
      className={`absolute select-none touch-none ${
        isSelected
          ? 'z-20 ring-2 ring-blue-500'
          : 'z-10 hover:ring-1 hover:ring-blue-400/70'
      } ${isEditingText ? 'cursor-text' : 'cursor-move'}`}
    >
      {/* شريط الإجراءات السريعة فوق العنصر المحدد */}
      {isSelected && !isEditingText && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute -top-9 left-0 flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-1.5 py-1 shadow-md"
        >
          <button
            type="button"
            onClick={onDuplicate}
            title="تكرار العنصر"
            className="rounded p-1 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            title="حذف العنصر (Delete)"
            className="rounded p-1 text-red-500 transition hover:bg-red-50 hover:text-red-700"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* محتوى العنصر */}
      {annotation.type === 'text' ? (
        <div
          style={{
            backgroundColor:
              annotation.backgroundColor === 'transparent'
                ? 'transparent'
                : annotation.backgroundColor,
            color: annotation.colorHex,
            fontSize: `${annotation.fontSize * pxPerPt}px`,
            fontWeight: annotation.bold ? 700 : 400,
            textAlign: annotation.align,
            lineHeight: 1.35,
            padding: `${4 * pxPerPt}px`,
          }}
          dir="auto"
          className="h-full w-full overflow-hidden break-words whitespace-pre-wrap"
        >
          {isEditingText ? (
            <textarea
              ref={textareaRef}
              value={annotation.content}
              onChange={(e) => onUpdate({ content: e.target.value })}
              onBlur={() => setIsEditingText(false)}
              onPointerDown={(e) => e.stopPropagation()}
              style={{
                color: annotation.colorHex,
                fontSize: `${annotation.fontSize * pxPerPt}px`,
                fontWeight: annotation.bold ? 700 : 400,
                textAlign: annotation.align,
                lineHeight: 1.35,
              }}
              dir="auto"
              className="h-full w-full resize-none bg-transparent outline-none"
            />
          ) : (
            annotation.content || (
              <span className="text-slate-400 italic">انقر مرتين للكتابة...</span>
            )
          )}
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={annotation.dataUrl}
          alt={annotation.label ?? 'صورة مضافة'}
          draggable={false}
          className="h-full w-full object-fill pointer-events-none"
        />
      )}

      {/* مقابض تغيير الحجم */}
      {isSelected && !isEditingText && (
        <>
          {(
            [
              ['nw', '-top-1.5 -left-1.5 cursor-nwse-resize'],
              ['ne', '-top-1.5 -right-1.5 cursor-nesw-resize'],
              ['sw', '-bottom-1.5 -left-1.5 cursor-nesw-resize'],
              ['se', '-bottom-1.5 -right-1.5 cursor-nwse-resize'],
            ] as [ResizeHandle, string][]
          ).map(([handle, posClass]) => (
            <div
              key={handle}
              onPointerDown={(e) => startResize(e, handle)}
              className={`absolute h-4 w-4 touch-none rounded-full border-2 border-blue-600 bg-white shadow sm:h-3 sm:w-3 ${posClass}`}
            />
          ))}

          {annotation.type === 'text' && (
            <>
              <div
                onPointerDown={(e) => startResize(e, 'e')}
                className="absolute -right-1.5 top-1/2 h-4 w-2 -translate-y-1/2 cursor-ew-resize rounded-full border border-blue-600 bg-white"
              />
              <div
                onPointerDown={(e) => startResize(e, 'w')}
                className="absolute -left-1.5 top-1/2 h-4 w-2 -translate-y-1/2 cursor-ew-resize rounded-full border border-blue-600 bg-white"
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
