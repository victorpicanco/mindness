import { expect, test } from '@playwright/test'

test('opens authentication from the public home', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveURL('/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Qual será o assunto de hoje?')
  await page.getByRole('banner').getByRole('button', { name: 'Entrar', exact: true }).click()

  const dialog = page.getByRole('dialog', { name: 'É bom ter você de volta.' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByLabel('E-mail', { exact: true })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Login', exact: true })).toBeVisible()
  await dialog.getByRole('tab', { name: 'Criar conta' }).click()
  await expect(page.getByRole('dialog', { name: 'Crie sua conta' })).toBeVisible()
  await page.keyboard.press('Escape')

  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page).toHaveURL('/')
})
