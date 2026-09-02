import { expect, test } from '@playwright/test'

test('sends a signed-out visitor to sign-in in a mobile viewport', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveURL(/\/auth\/sign-in\?/)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Avançar' })).toBeVisible()
})
