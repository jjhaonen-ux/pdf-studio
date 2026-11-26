import { test, expect } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';
import fs from 'node:fs/promises';

async function makePdfBuffer(pageCount: number): Promise<Buffer> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) {
    doc.addPage([420, 595]);
  }
  const bytes = await doc.save();
  return Buffer.from(bytes);
}

test.describe('محرر PDF المحلي — اختبارات E2E الشاملة', () => {
  test('يعالج الملفات محلياً دون رفع أي ملف PDF إلى خادم خارجي', async ({ page }) => {
    const uploadedPayloads: string[] = [];
    page.on('request', (req) => {
      if (req.method() !== 'GET' && !req.url().startsWith('http://127.0.0.1:3000')) {
        uploadedPayloads.push(req.url());
      }
      const postData = req.postData() ?? '';
      if (postData.includes('%PDF-')) {
        uploadedPayloads.push(req.url());
      }
    });

    await page.goto('/');
    await expect(page.getByText('محرر PDF المحلي')).toBeVisible();

    const pdfA = await makePdfBuffer(2);
    const pdfB = await makePdfBuffer(1);

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles([
      { name: 'alpha.pdf', mimeType: 'application/pdf', buffer: pdfA },
      { name: 'beta.pdf', mimeType: 'application/pdf', buffer: pdfB },
    ]);

    await expect(page.getByText('صفحات المستند الناتج (3 نشطة)')).toBeVisible();

    // تطبيق نطاق صفحات باستخدام أرقام عربية على الملف الأول (صفحة ١ فقط)
    const rangeInput = page.getByLabel('نطاق صفحات alpha.pdf');
    await rangeInput.fill('١');
    await page.getByRole('button', { name: 'تطبيق' }).first().click();
    await expect(page.getByText('صفحات المستند الناتج (2 نشطة)')).toBeVisible();

    // تجربة التراجع (Undo)
    await page.getByRole('button', { name: 'تراجع' }).click();
    await expect(page.getByText('صفحات المستند الناتج (3 نشطة)')).toBeVisible();

    // تصدير الملف الناتج والتحقق من أنه PDF سليم بعدد الصفحات المتوقع
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /تصدير \(3\)/ }).click();
    const download = await downloadPromise;
    const downloadedPath = await download.path();
    expect(downloadedPath).toBeTruthy();

    const exportedBytes = await fs.readFile(downloadedPath!);
    const parsedDoc = await PDFDocument.load(exportedBytes);
    expect(parsedDoc.getPageCount()).toBe(3);

    // التحقق من الخصوصية المطلقة
    expect(uploadedPayloads).toEqual([]);
  });

  test('يدعم تحرير الصفحة بإضافة نص عربي وتوقيع ثم تصدير ملف PDF صالح', async ({ page }) => {
    await page.goto('/');

    const pdfBytes = await makePdfBuffer(1);
    await page
      .locator('input[type="file"]')
      .first()
      .setInputFiles({ name: 'contract.pdf', mimeType: 'application/pdf', buffer: pdfBytes });

    await expect(page.getByText('صفحات المستند الناتج (1 نشطة)')).toBeVisible();

    // الانتقال إلى محرر الصفحة
    await page.getByRole('button', { name: /محرر الصفحة/ }).click();
    await expect(page.getByRole('button', { name: 'إضافة نص' })).toBeVisible();

    // إضافة نص عربي
    await page.getByRole('button', { name: 'إضافة نص' }).click();
    const textBox = page.locator('textarea').first();
    await textBox.fill('مُعتَمَد رسمياً — رقم 2026');

    // فتح لوحة التوقيع ورسم توقيع ثم إدراجه
    await page.getByRole('button', { name: 'إضافة توقيع' }).click();
    const sigCanvas = page.locator('[role="dialog"] canvas');
    const box = await sigCanvas.boundingBox();
    expect(box).toBeTruthy();
    if (box) {
      await page.mouse.move(box.x + 40, box.y + 80);
      await page.mouse.down();
      await page.mouse.move(box.x + 180, box.y + 110);
      await page.mouse.move(box.x + 260, box.y + 60);
      await page.mouse.up();
    }
    await page.getByRole('button', { name: 'إدراج التوقيع' }).click();

    await expect(page.getByText('عناصر الصفحة (2)')).toBeVisible();

    // التصدير والتحقق من الملف الناتج
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /تصدير \(1\)/ }).click();
    const download = await downloadPromise;
    const downloadedPath = await download.path();
    const exportedBytes = await fs.readFile(downloadedPath!);

    const parsedDoc = await PDFDocument.load(exportedBytes);
    expect(parsedDoc.getPageCount()).toBe(1);
    expect(exportedBytes.byteLength).toBeGreaterThan(pdfBytes.byteLength);
  });

  test('يرفض الملفات التالفة والمزيفة دون تعطيل التطبيق ويعرض رسالة خطأ واضحة', async ({
    page,
  }) => {
    await page.goto('/');

    const fakeTxtAsPdf = Buffer.from('This is plain text, not a PDF');
    const corruptedPdf = Buffer.from('%PDF-1.7\nCORRUPTED_DATA_WITHOUT_XREF');

    await page.locator('input[type="file"]').first().setInputFiles([
      { name: 'fake.pdf', mimeType: 'application/pdf', buffer: fakeTxtAsPdf },
      { name: 'broken.pdf', mimeType: 'application/pdf', buffer: corruptedPdf },
    ]);

    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText('تعذر تحميل 2 ملفات');

    // التأكد أن التطبيق لا يزال يعمل بسلاسة عند رفع ملف سليم بعد الخطأ
    const validPdf = await makePdfBuffer(1);
    await page
      .locator('input[type="file"]')
      .first()
      .setInputFiles({ name: 'good.pdf', mimeType: 'application/pdf', buffer: validPdf });

    await expect(page.getByText('صفحات المستند الناتج (1 نشطة)')).toBeVisible();
  });

  test('يعرض الواجهة بشكل متجاوب على الهاتف دون تجاوز أفقي وتفتح نافذة التوافق', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 2
    );
    expect(hasHorizontalOverflow).toBe(false);

    // فتح نافذة الخصوصية وفحص التوافق
    await page.getByRole('button', { name: 'الخصوصية وفحص التوافق والمساعدة' }).click();
    await expect(page.getByText('فحص توافق المتصفح والجهاز')).toBeVisible();
    await expect(page.getByText('معالجة محلية 100% داخل متصفحك')).toBeVisible();
  });
});
