import fs from 'node:fs/promises';
import path from 'node:path';
import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';

const outDir = path.join(process.cwd(), 'test-samples');

async function main() {
  await fs.mkdir(outDir, { recursive: true });

  // 1. ملف متعدد الصفحات سليم
  const multiDoc = await PDFDocument.create();
  const font = await multiDoc.embedFont(StandardFonts.HelveticaBold);
  for (let i = 1; i <= 5; i++) {
    const page = multiDoc.addPage([595, 842]);
    page.drawText(`Sample Document — Page ${i} of 5`, {
      x: 72,
      y: 740,
      size: 22,
      font,
      color: rgb(0.1, 0.25, 0.65),
    });
  }
  await fs.writeFile(path.join(outDir, '01-multi-page.pdf'), await multiDoc.save());

  // 2. ملف يحتوي على صفحات مدوّرة مسبقاً (90° و 180° و 270°)
  const rotatedDoc = await PDFDocument.create();
  const rFont = await rotatedDoc.embedFont(StandardFonts.Helvetica);
  for (const angle of [0, 90, 180, 270]) {
    const page = rotatedDoc.addPage([420, 595]);
    page.setRotation(degrees(angle));
    page.drawText(`Pre-rotated ${angle} deg`, {
      x: 60,
      y: 300,
      size: 20,
      font: rFont,
      color: rgb(0.05, 0.45, 0.3),
    });
  }
  await fs.writeFile(path.join(outDir, '02-pre-rotated.pdf'), await rotatedDoc.save());

  // 3. ملف نصي تم تغيير امتداده إلى .pdf (لاختبار رفض التوقيع الثنائي)
  await fs.writeFile(
    path.join(outDir, '03-fake-txt-as-pdf.pdf'),
    'This is a plain text file renamed to .pdf for security validation testing.\n',
    'utf-8'
  );

  // 4. ملف PDF تالف (يبدأ بتوقيع سليم لكنه بلا بنية XRef)
  await fs.writeFile(
    path.join(outDir, '04-corrupted.pdf'),
    '%PDF-1.7\n1 0 obj\n<< /Broken /Structure >>\nCORRUPTED_BYTES\n',
    'utf-8'
  );

  // 5. ملف PDF بعلامة تشفير /Encrypt (لاختبار رسالة الملف المشفر)
  await fs.writeFile(
    path.join(outDir, '05-encrypted-marker.pdf'),
    '%PDF-1.7\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Size 2 /Encrypt 9 0 R >>\n%%EOF\n',
    'utf-8'
  );

  console.log('تم إنشاء 5 ملفات اختبار بنجاح في:', outDir);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
