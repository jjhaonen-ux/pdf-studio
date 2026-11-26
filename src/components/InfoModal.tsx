'use client';

import { useEffect, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  Keyboard,
  MessageSquare,
  ShieldCheck,
  Smartphone,
  X,
  XCircle,
} from 'lucide-react';
import {
  checkBrowserCompatibility,
  type BrowserCompatibilityReport,
} from '@/core/pdf/compatibility';

interface InfoModalProps {
  open: boolean;
  onClose: () => void;
}

export function InfoModal({ open, onClose }: InfoModalProps) {
  const [report, setReport] = useState<BrowserCompatibilityReport | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      setReport(checkBrowserCompatibility());
      setCopied(false);
    }
  }, [open]);

  if (!open) return null;

  const handleCopyDiagnostics = async () => {
    if (!report) return;
    const summary = [
      'تقرير ملاحظات النسخة التجريبية — محرر PDF المحلي v1.0.0',
      `المقاس: ${report.viewport}`,
      `المتصفح: ${report.userAgent}`,
      'نتيجة فحص التوافق:',
      ...report.checks.map(
        (c) => `- ${c.label}: ${c.supported ? 'مدعوم' : 'غير مدعوم'} (${c.note})`
      ),
      'ملاحظة: لا يتضمن هذا التقرير أي بيانات من ملفات المستخدم.',
    ].join('\n');

    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // تجاهل في حال حظر الحافظة
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="الخصوصية وفحص التوافق والمساعدة"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[88vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              الخصوصية، التوافق، والمساعدة
            </h2>
            <p className="text-xs text-slate-500">
              محرر PDF المحلي — النسخة الأولى MVP (v1.0.0)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* الخصوصية */}
          <section className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5">
            <h3 className="flex items-center gap-1.5 text-sm font-bold text-emerald-900">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span>معالجة محلية 100% داخل متصفحك</span>
            </h3>
            <p className="mt-1.5 text-xs leading-relaxed text-emerald-800">
              جميع عمليات القراءة والدمج وتعديل الصفحات وتصدير ملف PDF تتم بالكامل على جهازك
              دون رفع أي مستند إلى خادم خارجي. كما يتم التحقق تلقائياً من سلامة الملف الناتج
              قبل تنزيله.
            </p>
          </section>

          {/* فحص توافق المتصفح */}
          {report && (
            <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
                  <Smartphone className="h-4 w-4 text-blue-600" />
                  <span>فحص توافق المتصفح والجهاز</span>
                </h3>
                <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600">
                  {report.viewport}
                </span>
              </div>

              <ul className="space-y-1.5">
                {report.checks.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-2 rounded-lg bg-white px-2.5 py-1.5 text-xs"
                  >
                    <span className="font-medium text-slate-700">{item.label}</span>
                    <span
                      className={`inline-flex items-center gap-1 font-semibold ${
                        item.supported ? 'text-emerald-700' : 'text-amber-700'
                      }`}
                    >
                      {item.supported ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5" />
                      )}
                      <span>{item.note}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* اختصارات لوحة المفاتيح */}
          <section className="rounded-xl border border-slate-200 bg-white p-3.5">
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-slate-900">
              <Keyboard className="h-4 w-4 text-blue-600" />
              <span>اختصارات لوحة المفاتيح</span>
            </h3>
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1.5">
                <span>تراجع</span>
                <kbd dir="ltr" className="rounded bg-white px-1.5 py-0.5 font-mono text-[11px] shadow-sm">
                  Ctrl + Z
                </kbd>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1.5">
                <span>إعادة التنفيذ</span>
                <kbd dir="ltr" className="rounded bg-white px-1.5 py-0.5 font-mono text-[11px] shadow-sm">
                  Ctrl + Y
                </kbd>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1.5">
                <span>حذف العنصر المحدد</span>
                <kbd dir="ltr" className="rounded bg-white px-1.5 py-0.5 font-mono text-[11px] shadow-sm">
                  Delete
                </kbd>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1.5">
                <span>تحريك دقيق</span>
                <kbd dir="ltr" className="rounded bg-white px-1.5 py-0.5 font-mono text-[11px] shadow-sm">
                  Arrows
                </kbd>
              </div>
            </div>
          </section>

          {/* جمع ملاحظات النسخة التجريبية */}
          <section className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-100 bg-blue-50/60 p-3.5">
            <div className="flex items-start gap-2">
              <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
              <div>
                <p className="text-xs font-bold text-blue-900">
                  ملاحظات النسخة التجريبية
                </p>
                <p className="text-[11px] text-blue-700">
                  انسخ بيانات التشخيص (دون أي ملفات) لإرفاقها عند الإبلاغ عن مشكلة.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void handleCopyDiagnostics()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>تم النسخ</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>نسخ التشخيص</span>
                </>
              )}
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
