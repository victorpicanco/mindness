import { expect, test } from '@playwright/test'

test('shows the home page in a mobile viewport', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { level: 1, name: 'Mindness' })).toBeVisible()
})
