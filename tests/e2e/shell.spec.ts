import { expect, test, type Page } from '@playwright/test';

async function openPreview(page: Page, path = '/preview') {
  await page.goto(path);
  await expect(page.getByRole('main')).toBeVisible();
  await expect(
    page.getByText('بيانات توضيحية لتجربة التصميم. لا توجد عمليات أو بيانات حقيقية.'),
  ).toBeVisible();
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    pageWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }));
  expect(dimensions.pageWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
}

test('keyboard command search navigates and returns focus on Escape', async ({ page }) => {
  await openPreview(page);
  const trigger = page.getByRole('button', { name: 'البحث والتنقل السريع', exact: true });
  await trigger.focus();
  await page.keyboard.press('Control+k');
  const dialog = page.getByRole('dialog', { name: 'البحث والتنقل السريع' });
  const input = dialog.getByRole('combobox', { name: 'ابحث عن صفحة' });
  await expect(dialog).toBeVisible();
  await expect(input).toBeFocused();
  await input.fill('شحن');
  await page.keyboard.press('ArrowDown');
  await expect(dialog.getByRole('option', { name: 'أنواع الشحنات' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/preview\/shipment-types$/);
  await expect(dialog).not.toBeVisible();

  await trigger.focus();
  await page.keyboard.press('Control+k');
  await expect(input).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test('command dialog keeps keyboard focus away from the workspace', async ({ page }) => {
  await openPreview(page);
  await page.getByRole('button', { name: 'البحث والتنقل السريع', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'البحث والتنقل السريع' });
  for (let index = 0; index < 5; index += 1) {
    await page.keyboard.press('Tab');
    await expect
      .poll(() => dialog.evaluate((element) => element.contains(document.activeElement)))
      .toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
});

test('sidebar collapse persists after reload and preserves accessible links', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openPreview(page);
  await page.getByRole('button', { name: 'طي القائمة الجانبية', exact: true }).click();
  const expandButton = page.getByRole('button', { name: 'توسيع القائمة الجانبية', exact: true });
  await expect(expandButton).toBeVisible();
  await page.reload();
  await expect(expandButton).toBeVisible();
  const sidebar = page.getByRole('complementary', { name: 'القائمة الجانبية' });
  await expect(sidebar.getByRole('link', { name: 'الشحنات', exact: true })).toBeVisible();
  const sidebarBox = await sidebar.boundingBox();
  expect(sidebarBox?.width).toBeLessThan(100);
  await expandButton.click();
  await expect(
    page.getByRole('button', { name: 'طي القائمة الجانبية', exact: true }),
  ).toBeVisible();
});

test('phone drawer is RTL, traps focus, and returns focus without horizontal overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openPreview(page);
  await expectNoHorizontalOverflow(page);
  await expect(page.getByRole('complementary', { name: 'القائمة الجانبية' })).toBeHidden();
  const trigger = page.getByRole('button', { name: 'فتح قائمة التنقل' });
  await trigger.click();
  const drawer = page.getByRole('dialog', { name: 'التنقل الرئيسي', exact: true });
  await expect(drawer).toBeVisible();
  await expect
    .poll(async () => {
      const drawerBox = await drawer.boundingBox();
      return Math.round((drawerBox?.x ?? 0) + (drawerBox?.width ?? 0));
    })
    .toBe(390);
  await expect(drawer.getByRole('button', { name: 'إغلاق القائمة' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect
    .poll(() => drawer.evaluate((element) => element.contains(document.activeElement)))
    .toBe(true);
  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await drawer.getByRole('link', { name: 'الإعدادات', exact: true }).click();
  await expect(page).toHaveURL(/\/preview\/settings$/);
  await expect(drawer).toBeHidden();
  await expectNoHorizontalOverflow(page);
});

test('phone notification and account popovers fit the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openPreview(page);
  await page.getByRole('button', { name: 'الإشعارات', exact: true }).click();
  const notification = page.getByRole('region', { name: 'الإشعارات', exact: true });
  await expect(notification.getByText('الإشعارات غير متاحة بعد')).toBeVisible();
  const notificationBox = await notification.boundingBox();
  expect(notificationBox?.x).toBeGreaterThanOrEqual(0);
  expect((notificationBox?.x ?? 0) + (notificationBox?.width ?? 0)).toBeLessThanOrEqual(390);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'قائمة معاينة الواجهة' }).click();
  const account = page.getByRole('menu', { name: 'خيارات الحساب' });
  await expect(account.getByRole('menuitem', { name: 'تفضيلات الواجهة' })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(account.getByRole('menuitem', { name: 'الانتقال إلى تسجيل الدخول' })).toBeFocused();
  const accountBox = await account.boundingBox();
  expect(accountBox?.x).toBeGreaterThanOrEqual(0);
  expect((accountBox?.x ?? 0) + (accountBox?.width ?? 0)).toBeLessThanOrEqual(390);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'قائمة معاينة الواجهة' })).toBeFocused();
  await expectNoHorizontalOverflow(page);
});

test('theme and table density take effect and persist', async ({ page }) => {
  await openPreview(page, '/preview/settings');
  const darkOption = page.getByRole('radio', { name: /داكن/ });
  await darkOption.focus();
  await darkOption.press('Space');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const comfortableOption = page.getByRole('radio', { name: /مريح/ });
  await comfortableOption.focus();
  await comfortableOption.press('Space');
  await expect(page.locator('html')).toHaveAttribute('data-density', 'comfortable');
  await page.reload();
  await expect(darkOption).toBeChecked();
  await expect(comfortableOption).toBeChecked();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('html')).toHaveAttribute('data-density', 'comfortable');
  const lightOption = page.getByRole('radio', { name: /فاتح/ });
  await lightOption.focus();
  await lightOption.press('Space');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('keyboard skip link targets the main workspace', async ({ page }) => {
  await openPreview(page);
  await page.keyboard.press('Tab');
  const skipLink = page.getByRole('link', { name: 'انتقل إلى المحتوى الرئيسي' });
  await expect(skipLink).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
});
