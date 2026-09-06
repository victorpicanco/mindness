import type { PrismaClient } from '@/generated/prisma/client.js'
const THEME_TABLES = ['themes', 'theme_categories']

export function clearThemeData(prisma: PrismaClient): Promise<number> {
  return prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${THEME_TABLES.join(', ')} RESTART IDENTITY CASCADE`,
  )
}
