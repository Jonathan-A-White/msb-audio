import { test, expect } from '@playwright/test';

test.describe('Directory Selection', () => {
  test('shows compatibility warning when File System Access API is not supported', async ({
    page,
  }) => {
    // Playwright's Chromium supports the API, so we need to remove it
    await page.addInitScript(() => {
      // @ts-expect-error - removing browser API for test
      delete window.showDirectoryPicker;
    });
    await page.goto('/');
    await expect(
      page.getByText('File System Access API is not available')
    ).toBeVisible();
  });

  test('shows Choose Download Folder button on first load', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(
      page.getByRole('button', { name: /Choose Download Folder/i })
    ).toBeVisible();
  });

  test('displays all 66 books grouped by testament', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Old Testament')).toBeVisible();
    await expect(page.getByText('New Testament')).toBeVisible();
    // Check first and last books
    await expect(page.getByText('Genesis')).toBeVisible();
    await expect(page.getByText('Revelation')).toBeVisible();
  });

  test('download buttons are disabled when no folder selected', async ({
    page,
  }) => {
    await page.goto('/');
    const downloadBtn = page.getByRole('button', { name: 'Download All' });
    await expect(downloadBtn).toBeDisabled();
  });
});

test.describe('Book List', () => {
  test('can collapse and expand testament sections', async ({ page }) => {
    await page.goto('/');
    const otHeader = page.getByRole('button', { name: /Old Testament/i });

    // Collapse OT section
    await otHeader.click();
    await expect(page.getByText('Genesis')).not.toBeVisible();

    // Expand OT section
    await otHeader.click();
    await expect(page.getByText('Genesis')).toBeVisible();
  });

  test('shows correct book numbers', async ({ page }) => {
    await page.goto('/');
    // Check a few known book numbers
    await expect(page.getByText('01').first()).toBeVisible();
    await expect(page.getByText('66')).toBeVisible();
  });
});
