import { expect, test } from '@playwright/test';

test.describe('isolated shipment previews', () => {
  test('debounces search into the URL, keeps it after reload, and removes the filter chip', async ({
    page,
  }) => {
    await page.goto('/preview/shipments');
    await expect(page.getByRole('table')).toBeVisible();
    await page.getByRole('searchbox', { name: 'البحث برقم التتبع أو الاسم' }).fill('DEMO-2048');

    await expect(page).toHaveURL((url) => url.searchParams.get('q') === 'DEMO-2048');
    await expect(page.getByRole('table').getByRole('row')).toHaveCount(2);
    await expect(page.getByRole('link', { name: 'DEMO-2048', exact: true })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('searchbox')).toHaveValue('DEMO-2048');
    await page.getByRole('button', { name: 'إزالة تصفية البحث' }).click();
    await expect(page).toHaveURL((url) => !url.searchParams.has('q'));
    await expect(page.getByRole('searchbox')).toHaveValue('');
    await expect(page.getByRole('table').getByRole('row')).toHaveCount(9);
  });

  test('combines filters, clears cursor state, and follows browser history', async ({ page }) => {
    await page.goto('/preview/shipments?cursor=preview-only');
    await page.getByRole('combobox', { name: 'من مدينة', exact: true }).selectOption('طرابلس');
    await expect(page).toHaveURL(
      (url) => url.searchParams.get('origin') === 'طرابلس' && !url.searchParams.has('cursor'),
    );
    await expect(page.getByRole('table').getByRole('row')).toHaveCount(4);

    await page.getByRole('button', { name: 'في الطريق', exact: true }).click();
    await expect(page).toHaveURL((url) => url.searchParams.get('status') === 'في الطريق');
    await expect(page.getByRole('table').getByRole('row')).toHaveCount(2);

    await page.goBack();
    await expect(page).toHaveURL(
      (url) => url.searchParams.get('origin') === 'طرابلس' && !url.searchParams.has('status'),
    );
    await expect(page.getByRole('table').getByRole('row')).toHaveCount(4);
    await page.getByRole('button', { name: 'مسح الكل', exact: true }).click();
    await expect(page).toHaveURL((url) => url.pathname === '/preview/shipments' && !url.search);
    await expect(page.getByRole('table').getByRole('row')).toHaveCount(9);
  });

  test('changes columns in a keyboard-safe dialog and restores focus on Escape', async ({
    page,
  }) => {
    await page.goto('/preview/shipments');
    const trigger = page.getByRole('button', { name: 'الأعمدة', exact: true });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'الأعمدة المعروضة' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'إغلاق خيارات الأعمدة' })).toBeFocused();
    await dialog.getByRole('checkbox', { name: 'تاريخ الإنشاء', exact: true }).check();
    await expect(
      dialog.getByRole('checkbox', { name: 'تاريخ الإنشاء', exact: true }),
    ).toBeChecked();
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
    await expect(
      page.getByRole('columnheader', { name: 'تاريخ الإنشاء', exact: true }),
    ).toBeVisible();
  });

  test('copies the sample tracking number with feedback and disables workflow changes', async ({
    page,
    context,
    baseURL,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
      origin: baseURL,
    });
    await page.goto('/preview/shipments/sample-001');
    await page.getByRole('button', { name: 'نسخ رقم التتبع' }).click();
    await expect(page.getByRole('status')).toContainText('تم نسخ رقم التتبع');
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('DEMO-2048');
    await expect(page.getByRole('button', { name: 'تغيير الحالة', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'تعيين سائق', exact: true })).toBeDisabled();
  });

  test('keeps creation and pricing unavailable without issuing a write', async ({ page }) => {
    const writes: string[] = [];
    page.on('request', (request) => {
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method())) writes.push(request.url());
    });
    await page.goto('/preview/shipments/new');
    await page.getByRole('textbox', { name: 'اسم المرسل' }).fill('اسم توضيحي');
    await page.getByRole('textbox', { name: 'اسم المستلم' }).fill('اسم مستلم توضيحي');
    await page
      .getByRole('textbox', { name: 'ملاحظات الشحنة' })
      .fill('مسودة محلية لتجربة حقول النموذج.');
    await expect(page.getByRole('button', { name: 'إنشاء الشحنة', exact: true })).toBeDisabled();
    await expect(
      page.getByRole('combobox', { name: 'مدينة الانطلاق', exact: true }),
    ).toBeDisabled();
    await expect(page.getByText('لم يُحسب أو يُطلب أي سعر.')).toBeVisible();
    await page.getByRole('textbox', { name: 'اسم المرسل' }).press('Enter');
    await expect(page).toHaveURL(/\/preview\/shipments\/new$/);
    expect(writes).toEqual([]);
  });
});
