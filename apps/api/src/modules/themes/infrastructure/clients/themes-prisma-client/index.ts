import type {
  Theme,
  ThemeCategory,
  ThemeDifficulty,
  ThemePublicationStatus,
} from '@/generated/prisma/client.js'
import type { Prisma } from '@/generated/prisma/client.js'

export type ThemeRow = Theme
export type ThemeCategoryRow = ThemeCategory

export interface ThemeUpsertArgs {
  readonly where: { readonly id: string }
  readonly create: ThemeRow
  readonly update: ThemeRow
}

export interface ThemeCategoryUpsertArgs {
  readonly where: { readonly id: string }
  readonly create: ThemeCategoryRow
  readonly update: ThemeCategoryRow
}

export interface ThemeCombinationRow {
  readonly categoryId: string
  readonly difficulty: ThemeDifficulty
}

export interface ThemeFindManyArgs {
  readonly where:
    | { readonly publicationStatus: ThemePublicationStatus }
    | { readonly id: { readonly in: string[] } }
    | { readonly categoryId: { readonly in: string[] } }
  readonly distinct?: ['categoryId', 'difficulty']
}

export interface ThemeCategoryFindManyArgs {
  readonly where:
    | { readonly themes: { readonly some: { readonly publicationStatus: ThemePublicationStatus } } }
    | { readonly slug: { readonly in: string[] } }
}

export interface ThemesPrismaClient {
  readonly theme: {
    findUnique(args: { readonly where: { readonly id: string } }): Promise<ThemeRow | null>
    findFirst(args: {
      readonly where: { readonly categoryId: string; readonly normalizedTitle: string }
    }): Promise<ThemeRow | null>
    upsert(args: ThemeUpsertArgs): Promise<ThemeRow>
    count(args: {
      readonly where: {
        readonly categoryId: string
        readonly difficulty: ThemeDifficulty
        readonly publicationStatus: ThemePublicationStatus
      }
    }): Promise<number>
    findMany(args: ThemeFindManyArgs): Promise<ThemeRow[]>
  }
  readonly themeCategory: {
    findUnique(args: {
      readonly where: { readonly id: string } | { readonly slug: string }
    }): Promise<ThemeCategoryRow | null>
    upsert(args: ThemeCategoryUpsertArgs): Promise<ThemeCategoryRow>
    findMany(args: ThemeCategoryFindManyArgs): Promise<ThemeCategoryRow[]>
  }
  $queryRaw(
    query: TemplateStringsArray | Prisma.Sql,
    ...values: readonly unknown[]
  ): Promise<unknown>
  $executeRaw(query: Prisma.Sql): Promise<number>
}

export interface ThemesTransactionOptions {
  readonly isolationLevel: 'Serializable'
  readonly timeout: number
}

export interface ThemesPrismaTransactionRunner {
  $transaction<T>(
    operation: (transaction: ThemesPrismaClient) => Promise<T>,
    options: ThemesTransactionOptions,
  ): Promise<T>
}
